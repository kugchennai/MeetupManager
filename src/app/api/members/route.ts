import { NextRequest, NextResponse } from "next/server";
import { prisma, prismaUnfiltered } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth-helpers";
import { hasMinimumRole } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { sendMemberInvitationEmail } from "@/lib/emails/triggers";
import type { GlobalRole } from "@/generated/prisma/enums";

export async function GET(req: Request) {
  const session = await getAuthSession(req);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasMinimumRole(session.user.globalRole as GlobalRole, "ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    where: {
      // Members API should never include volunteer-role users
      globalRole: { not: "VOLUNTEER" },
    },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      globalRole: true,
      createdAt: true,
      eventMembers: {
        select: {
          eventRole: true,
          event: {
            select: { id: true, title: true, date: true, status: true },
          },
        },
      },
      _count: {
        select: {
          createdEvents: true,
          ownedSpeakers: true,
          ownedVolunteers: true,
          ownedVenuePartners: true,
          ownedTasks: true,
          assignedTasks: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(
    users.map((u) => {
      const ownershipCount =
        u._count.createdEvents +
        u._count.ownedSpeakers +
        u._count.ownedVolunteers +
        u._count.ownedVenuePartners +
        u._count.ownedTasks +
        u._count.assignedTasks;
      return {
        ...u,
        events: u.eventMembers.map((em) => ({
          eventRole: em.eventRole,
          event: em.event,
          status: em.event.status,
        })),
        eventsCount: u.eventMembers.length,
        ownershipCount,
        eventMembers: undefined,
        _count: undefined,
      };
    })
  );
}

export async function POST(req: NextRequest) {
  const session = await getAuthSession(req);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasMinimumRole(session.user.globalRole as GlobalRole, "ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { email, name, globalRole } = body;

  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const normalizedEmail = email.trim().toLowerCase();

  // Use unfiltered client to also find soft-deleted users for reactivation
  const existing = await prismaUnfiltered.user.findUnique({
    where: { email: normalizedEmail },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      globalRole: true,
      createdAt: true,
      deletedAt: true,
    },
  });

  if (existing && !existing.deletedAt) {
    return NextResponse.json(
      { error: "A member with this email already exists" },
      { status: 409 }
    );
  }

  // Reactivate soft-deleted user
  if (existing?.deletedAt) {
    // Check if this email now belongs to a volunteer — use convert flow instead
    const existingVolunteer = await prisma.volunteer.findFirst({
      where: { email: normalizedEmail },
    });

    if (existingVolunteer) {
      return NextResponse.json(
        {
          error: `This email belongs to volunteer "${existingVolunteer.name}". Use the "Promote to Member" action on the Volunteers page instead of reactivating directly.`,
        },
        { status: 409 }
      );
    }

    const callerRole = session.user.globalRole as GlobalRole;
    const assignableRoles: GlobalRole[] = ["EVENT_LEAD", "VOLUNTEER"];
    if (callerRole === "SUPER_ADMIN") assignableRoles.unshift("ADMIN");
    const role = assignableRoles.includes(globalRole) ? globalRole : "EVENT_LEAD";

    const reactivated = await prismaUnfiltered.user.update({
      where: { id: existing.id },
      data: {
        deletedAt: null,
        name: name?.trim() || existing.name,
        globalRole: role,
      },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        globalRole: true,
        createdAt: true,
      },
    });

    await logAudit({
      userId: session.user.id,
      action: "UPDATE",
      entityType: "User",
      entityId: reactivated.id,
      entityName: reactivated.name ?? reactivated.email ?? undefined,
      changes: { action: "reactivated", globalRole: role },
    });

    // Send member invitation email (awaited for serverless compatibility)
    await sendMemberInvitationEmail(
      normalizedEmail,
      reactivated.name ?? normalizedEmail,
      role,
      session.user.name ?? "Admin"
    );

    return NextResponse.json(reactivated, { status: 201 });
  }

  // Prevent adding someone who is already a volunteer — use the convert flow instead
  const existingVolunteer = await prisma.volunteer.findFirst({
    where: { email: normalizedEmail },
  });

  if (existingVolunteer) {
    return NextResponse.json(
      {
        error: `This email belongs to volunteer "${existingVolunteer.name}". Use the "Promote to Member" action on the Volunteers page instead of adding them directly.`,
      },
      { status: 409 }
    );
  }

  const callerRole = session.user.globalRole as GlobalRole;
  const assignableRoles: GlobalRole[] = ["EVENT_LEAD"];
  if (callerRole === "SUPER_ADMIN") assignableRoles.unshift("ADMIN");
  const role = assignableRoles.includes(globalRole) ? globalRole : "EVENT_LEAD";

  if (globalRole === "ADMIN" && callerRole !== "SUPER_ADMIN") {
    return NextResponse.json(
      { error: "Only Super Admin can assign the Admin role" },
      { status: 403 }
    );
  }

  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      name: name?.trim() || null,
      globalRole: role,
    },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      globalRole: true,
      createdAt: true,
    },
  });

  await logAudit({
    userId: session.user.id,
    action: "CREATE",
    entityType: "User",
    entityId: user.id,
    entityName: user.name ?? user.email ?? undefined,
    changes: { globalRole: role },
  });

  // Send member invitation email (awaited for serverless compatibility)
  await sendMemberInvitationEmail(
    normalizedEmail,
    user.name ?? normalizedEmail,
    role,
    session.user.name ?? "Admin"
  );

  return NextResponse.json(user, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const session = await getAuthSession(req);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasMinimumRole(session.user.globalRole as GlobalRole, "ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { userId, globalRole, name } = body;

  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  const before = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, globalRole: true },
  });

  if (!before) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const data: Record<string, unknown> = {};
  const changes: Record<string, unknown> = {};

  // Handle name update
  if (name !== undefined) {
    if (typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
    }
    data.name = name.trim();
    changes.name = { from: before.name, to: name.trim() };
  }

  // Handle role update
  if (globalRole !== undefined) {
    if (before.globalRole === "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Cannot change the Super Admin's role" },
        { status: 403 }
      );
    }

    if (userId === session.user.id) {
      return NextResponse.json(
        { error: "You cannot change your own role" },
        { status: 400 }
      );
    }

    const callerRole = session.user.globalRole as GlobalRole;
    if (callerRole === "ADMIN" && before.globalRole === "ADMIN") {
      return NextResponse.json(
        { error: "Only a Super Admin can change another Admin's role" },
        { status: 403 }
      );
    }

    const assignableRoles: GlobalRole[] = ["EVENT_LEAD"];
    const patchCallerRole = session.user.globalRole as GlobalRole;
    if (patchCallerRole === "SUPER_ADMIN") assignableRoles.unshift("ADMIN");

    if (!assignableRoles.includes(globalRole)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    if (globalRole === "ADMIN" && patchCallerRole !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Only Super Admin can assign the Admin role" },
        { status: 403 }
      );
    }

    data.globalRole = globalRole;
    changes.globalRole = { from: before.globalRole, to: globalRole };
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data,
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      globalRole: true,
    },
  });

  await logAudit({
    userId: session.user.id,
    action: "UPDATE",
    entityType: "User",
    entityId: userId,
    entityName: updated.name ?? updated.email ?? undefined,
    changes,
  });

  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest) {
  const session = await getAuthSession(req);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only SUPER_ADMIN can remove members
  if (session.user.globalRole !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden: Super Admin only" }, { status: 403 });
  }

  const body = await req.json();
  const { userId, reassignToUserId } = body;

  if (!userId || typeof userId !== "string") {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  // Cannot delete yourself
  if (userId === session.user.id) {
    return NextResponse.json({ error: "You cannot remove yourself" }, { status: 400 });
  }

  // Find target user (use unfiltered to detect already-deleted)
  const target = await prismaUnfiltered.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, globalRole: true, deletedAt: true },
  });

  if (!target || target.deletedAt) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Cannot remove another SUPER_ADMIN
  if (target.globalRole === "SUPER_ADMIN") {
    return NextResponse.json({ error: "Cannot remove a Super Admin" }, { status: 403 });
  }

  // Check ownership across all entity types
  const [
    createdEventsCount,
    ownedSpeakersCount,
    ownedVolunteersCount,
    ownedVenuePartnersCount,
    ownedTasksCount,
    assignedTasksCount,
  ] = await Promise.all([
    prisma.event.count({ where: { createdById: userId } }),
    prisma.eventSpeaker.count({ where: { ownerId: userId } }),
    prisma.eventVolunteer.count({ where: { ownerId: userId } }),
    prisma.eventVenuePartner.count({ where: { ownerId: userId } }),
    prisma.sOPTask.count({ where: { ownerId: userId } }),
    prisma.sOPTask.count({ where: { assigneeId: userId } }),
  ]);

  const totalOwnership =
    createdEventsCount +
    ownedSpeakersCount +
    ownedVolunteersCount +
    ownedVenuePartnersCount +
    ownedTasksCount +
    assignedTasksCount;

  // If user has ownership, reassignment target is required
  if (totalOwnership > 0 && !reassignToUserId) {
    return NextResponse.json(
      {
        error: "This member has event ownership. Please select an admin to reassign their responsibilities to.",
        requiresReassignment: true,
        ownershipCount: totalOwnership,
      },
      { status: 400 }
    );
  }

  // Validate reassignment target
  if (reassignToUserId) {
    if (reassignToUserId === userId) {
      return NextResponse.json(
        { error: "Cannot reassign to the same user being removed" },
        { status: 400 }
      );
    }

    const reassignTarget = await prisma.user.findFirst({
      where: {
        id: reassignToUserId,
        globalRole: { in: ["ADMIN", "SUPER_ADMIN"] },
      },
      select: { id: true },
    });

    if (!reassignTarget) {
      return NextResponse.json(
        { error: "Reassignment target must be an active Admin or Super Admin" },
        { status: 400 }
      );
    }
  }

  // Execute soft-delete in a transaction
  await prisma.$transaction(async (tx) => {
    if (reassignToUserId && totalOwnership > 0) {
      // Reassign Event.createdById
      await tx.event.updateMany({
        where: { createdById: userId },
        data: { createdById: reassignToUserId },
      });

      // Reassign EventSpeaker.ownerId
      await tx.eventSpeaker.updateMany({
        where: { ownerId: userId },
        data: { ownerId: reassignToUserId },
      });

      // Reassign EventVolunteer.ownerId
      await tx.eventVolunteer.updateMany({
        where: { ownerId: userId },
        data: { ownerId: reassignToUserId },
      });

      // Reassign EventVenuePartner.ownerId
      await tx.eventVenuePartner.updateMany({
        where: { ownerId: userId },
        data: { ownerId: reassignToUserId },
      });

      // Reassign SOPTask.ownerId
      await tx.sOPTask.updateMany({
        where: { ownerId: userId },
        data: { ownerId: reassignToUserId },
      });

      // Reassign SOPTask.assigneeId
      await tx.sOPTask.updateMany({
        where: { assigneeId: userId },
        data: { assigneeId: reassignToUserId },
      });
    }

    // Soft-delete the user
    await tx.user.update({
      where: { id: userId },
      data: { deletedAt: new Date() },
    });
  });

  await logAudit({
    userId: session.user.id,
    action: "DELETE",
    entityType: "User",
    entityId: userId,
    entityName: target.name ?? target.email ?? undefined,
    changes: {
      removedRole: target.globalRole,
      ...(reassignToUserId ? { reassignedTo: reassignToUserId } : {}),
    },
  });

  return NextResponse.json({ success: true });
}
