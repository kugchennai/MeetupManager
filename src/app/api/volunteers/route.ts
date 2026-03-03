import { NextRequest, NextResponse } from "next/server";
import { prisma, prismaUnfiltered } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth-helpers";
import { hasMinimumRole } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { sendVolunteerWelcomeEmail } from "@/lib/emails/triggers";
import type { GlobalRole } from "@/generated/prisma/enums";

export async function GET(req: Request) {
  const session = await getAuthSession(req);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only return standalone volunteers (not linked to members)
  // Members assigned to events as volunteers are tracked separately
  const volunteers = await prisma.volunteer.findMany({
    where: {
      userId: null, // Exclude member-linked volunteers
    },
    include: {
      events: {
        select: {
          status: true,
          event: {
            select: { id: true, title: true, date: true },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(
    volunteers.map((v) => ({
      ...v,
      eventsCount: v.events.length,
    }))
  );
}

export async function POST(req: NextRequest) {
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
  const { name, email, discordId, role } = body;

  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json(
      { error: "Name is required" },
      { status: 400 }
    );
  }

  // Prevent adding someone who is already a member (including soft-deleted)
  if (email && typeof email === "string" && email.trim()) {
    const normalizedEmail = email.trim().toLowerCase();

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
      where: { email: normalizedEmail },
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

  const volunteer = await prisma.volunteer.create({
    data: {
      name: name.trim(),
      email: email?.trim() || null,
      discordId: discordId?.trim() || null,
      role: role?.trim() || null,
    },
  });

  await logAudit({
    userId: session.user.id,
    action: "CREATE",
    entityType: "Volunteer",
    entityId: volunteer.id,
    entityName: volunteer.name,
    changes: { name: volunteer.name, email: volunteer.email, discordId: volunteer.discordId, role: volunteer.role },
  });

  // Send welcome email (awaited for serverless compatibility)
  if (volunteer.email) {
    await sendVolunteerWelcomeEmail(
      volunteer.name,
      volunteer.email,
      volunteer.role,
      session.user.name ?? "Team Admin"
    );
  }

  return NextResponse.json(volunteer, { status: 201 });
}
