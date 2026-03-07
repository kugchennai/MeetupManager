import { NextRequest, NextResponse } from "next/server";
import { prisma, prismaUnfiltered } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth-helpers";
import { hasMinimumRole } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { sendVolunteerPromotionEmail } from "@/lib/emails/triggers";
import type { GlobalRole } from "@/generated/prisma/enums";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getAuthSession(req);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasMinimumRole(session.user.globalRole as GlobalRole, "ADMIN")) {
    return NextResponse.json({ error: "Forbidden: Admin role required" }, { status: 403 });
  }

  const volunteer = await prisma.volunteer.findUnique({ where: { id } });
  if (!volunteer) {
    return NextResponse.json({ error: "Volunteer not found" }, { status: 404 });
  }

  if (volunteer.userId) {
    return NextResponse.json(
      { error: "This volunteer is already linked to a member account" },
      { status: 409 }
    );
  }

  if (!volunteer.email) {
    return NextResponse.json(
      { error: "Volunteer must have an email address to be converted to a member" },
      { status: 400 }
    );
  }

  // Check volunteer promotion threshold
  const thresholdSetting = await prisma.appSetting.findUnique({
    where: { key: "volunteer_promotion_threshold" },
  });
  const threshold = parseInt(thresholdSetting?.value ?? "5", 10);
  const eventCount = await prisma.eventVolunteer.count({
    where: { volunteerId: id },
  });

  if (eventCount < threshold) {
    return NextResponse.json(
      {
        error: `Volunteer needs at least ${threshold} event contributions to be eligible (currently has ${eventCount})`,
      },
      { status: 400 }
    );
  }

  const normalizedEmail = volunteer.email.trim().toLowerCase();

  // Use unfiltered client to detect soft-deleted users for reactivation
  const existingUser = await prismaUnfiltered.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (existingUser) {
    // Reactivate soft-deleted user if needed
    if (existingUser.deletedAt) {
      await prismaUnfiltered.user.update({
        where: { id: existingUser.id },
        data: { deletedAt: null, globalRole: "EVENT_LEAD", phone: volunteer.phone },
      });
    } else {
      // Upgrade role to Member (EVENT_LEAD) if currently lower
      const ROLE_LEVEL: Record<string, number> = { VIEWER: 0, VOLUNTEER: 1, EVENT_LEAD: 2, ADMIN: 3, SUPER_ADMIN: 4 };
      if ((ROLE_LEVEL[existingUser.globalRole] ?? 0) < ROLE_LEVEL.EVENT_LEAD) {
        await prisma.user.update({
          where: { id: existingUser.id },
          data: { globalRole: "EVENT_LEAD" },
        });
      }
    }

    // Remove volunteer from directory
    await prisma.volunteer.delete({ where: { id } });

    await logAudit({
      userId: session.user.id,
      action: "UPDATE",
      entityType: "Volunteer",
      entityId: id,
      entityName: volunteer.name,
      changes: { action: "promoted_to_member", memberEmail: normalizedEmail },
    });

    // Send volunteer promotion email
    await sendVolunteerPromotionEmail(volunteer.name, normalizedEmail);

    return NextResponse.json({
      user: { ...existingUser, globalRole: "EVENT_LEAD" },
      linked: true,
      message: "Volunteer promoted to member and removed from volunteer directory",
    });
  }

  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      name: volunteer.name,
      phone: volunteer.phone,
      globalRole: "EVENT_LEAD",
    },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      globalRole: true,
    },
  });

  // Remove volunteer from directory
  await prisma.volunteer.delete({ where: { id } });

  await logAudit({
    userId: session.user.id,
    action: "CREATE",
    entityType: "User",
    entityId: user.id,
    entityName: user.name ?? user.email ?? undefined,
    changes: { convertedFromVolunteer: volunteer.name, globalRole: "EVENT_LEAD" },
  });

  // Send volunteer promotion email
  await sendVolunteerPromotionEmail(volunteer.name, normalizedEmail);

  return NextResponse.json({
    user,
    linked: false,
    message: "Volunteer promoted to member and removed from volunteer directory",
  }, { status: 201 });
}
