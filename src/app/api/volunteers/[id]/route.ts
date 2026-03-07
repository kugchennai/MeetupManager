import { NextRequest, NextResponse } from "next/server";
import { prisma, prismaUnfiltered } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth-helpers";
import { hasMinimumRole } from "@/lib/permissions";
import { logAudit, diffChanges } from "@/lib/audit";
import type { GlobalRole } from "@/generated/prisma/enums";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getAuthSession(req);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const volunteer = await prisma.volunteer.findUnique({
    where: { id },
    include: {
      events: {
        include: {
          event: { select: { id: true, title: true, date: true } },
        },
      },
      _count: { select: { events: true } },
    },
  });

  if (!volunteer) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    ...volunteer,
    eventsCount: volunteer._count.events,
    _count: undefined,
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getAuthSession(req);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasMinimumRole(session.user.globalRole as GlobalRole, "EVENT_LEAD")) {
    return NextResponse.json(
      { error: "Forbidden: Event Lead role required" },
      { status: 403 }
    );
  }

  const body = await req.json();
  const { name, email, phone, discordId, role } = body;

  const before = await prisma.volunteer.findUnique({ where: { id } });
  if (!before) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updateData: { name?: string; email?: string | null; phone?: string | null; discordId?: string | null; role?: string | null } = {};
  if (name !== undefined) updateData.name = typeof name === "string" ? name.trim() : before.name;

  if (email !== undefined) {
    if (typeof email !== "string" || !email.trim()) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }
    updateData.email = email.trim();
  }

  if (phone !== undefined) {
    if (typeof phone !== "string" || !phone.trim()) {
      return NextResponse.json({ error: "Phone number is required" }, { status: 400 });
    }
    updateData.phone = phone.trim();
  }

  if (discordId !== undefined) updateData.discordId = discordId === "" || discordId == null ? null : String(discordId).trim();
  if (role !== undefined) updateData.role = role === "" || role == null ? null : String(role).trim();

  if (updateData.name === "") {
    return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
  }

  // If email is being changed, validate it doesn't belong to a member (including soft-deleted)
  if (updateData.email && updateData.email !== before.email) {
    const normalizedEmail = updateData.email.trim().toLowerCase();

    const existingMember = await prismaUnfiltered.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingMember && !existingMember.deletedAt) {
      return NextResponse.json(
        {
          error: `This email belongs to existing member "${existingMember.name ?? existingMember.email}". Members cannot be added as volunteers directly.`,
        },
        { status: 409 }
      );
    }

    // Also check for duplicate volunteer email
    const existingVolunteer = await prisma.volunteer.findFirst({
      where: { email: normalizedEmail, id: { not: id } },
    });

    if (existingVolunteer) {
      return NextResponse.json(
        {
          error: `A volunteer with this email already exists: "${existingVolunteer.name}"`,
        },
        { status: 409 }
      );
    }
  }

  const volunteer = await prisma.volunteer.update({
    where: { id },
    data: updateData,
  });

  const changes = diffChanges(
    { name: before.name, email: before.email, phone: before.phone, discordId: before.discordId, role: before.role },
    { name: volunteer.name, email: volunteer.email, phone: volunteer.phone, discordId: volunteer.discordId, role: volunteer.role }
  );

  if (Object.keys(changes).length > 0) {
    await logAudit({
      userId: session.user.id,
      action: "UPDATE",
      entityType: "Volunteer",
      entityId: id,
      entityName: volunteer.name,
      changes,
    });
  }

  return NextResponse.json(volunteer);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getAuthSession(req);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasMinimumRole(session.user.globalRole as GlobalRole, "EVENT_LEAD")) {
    return NextResponse.json(
      { error: "Forbidden: Event Lead role required" },
      { status: 403 }
    );
  }

  const volunteer = await prisma.volunteer.findUnique({ where: { id } });
  if (!volunteer) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.volunteer.delete({ where: { id } });

  await logAudit({
    userId: session.user.id,
    action: "DELETE",
    entityType: "Volunteer",
    entityId: id,
    entityName: volunteer.name,
    changes: { name: volunteer.name },
  });

  return NextResponse.json({ success: true });
}
