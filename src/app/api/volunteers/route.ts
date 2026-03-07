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

  // Primary source: users table (globalRole=VOLUNTEER) so logged-in volunteers always appear.
  const volunteerUsers = await prisma.user.findMany({
    where: { globalRole: "VOLUNTEER" },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      image: true,
      createdAt: true,
      updatedAt: true,
      volunteerProfile: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          discordId: true,
          role: true,
          userId: true,
          createdAt: true,
          updatedAt: true,
          events: {
            select: {
              status: true,
              event: {
                select: { id: true, title: true, date: true },
              },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Secondary source: unlinked volunteer rows (not yet logged in / not yet linked).
  const unlinkedVolunteers = await prisma.volunteer.findMany({
    where: { userId: null },
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

  const normalizedFromUsers = volunteerUsers.map((u) => {
    const profile = u.volunteerProfile;
    const events = profile?.events ?? [];
    return {
      id: profile?.id ?? `user-${u.id}`,
      name: profile?.name ?? u.name ?? u.email ?? "Unnamed Volunteer",
      email: profile?.email ?? u.email,
      phone: profile?.phone ?? u.phone,
      discordId: profile?.discordId ?? null,
      role: profile?.role ?? null,
      userId: u.id,
      user: { id: u.id, name: u.name, image: u.image },
      createdAt: profile?.createdAt ?? u.createdAt,
      updatedAt: profile?.updatedAt ?? u.updatedAt,
      events,
      eventsCount: events.length,
    };
  });

  const normalizedUnlinked = unlinkedVolunteers.map((v) => ({
    ...v,
    eventsCount: v.events.length,
  }));

  // Merge and dedupe by volunteer row id (or fallback to email for synthetic user rows).
  const byKey = new Map<string, (typeof normalizedFromUsers)[number] | (typeof normalizedUnlinked)[number]>();
  for (const v of normalizedUnlinked) {
    byKey.set(v.id, v);
  }
  for (const v of normalizedFromUsers) {
    const key = v.id.startsWith("user-") ? `email:${(v.email ?? "").toLowerCase()}` : v.id;
    byKey.set(key, v);
  }

  return NextResponse.json(Array.from(byKey.values()));
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
  const { name, email, phone, discordId, role } = body;

  if (!email || typeof email !== "string" || !email.trim()) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  if (!phone || typeof phone !== "string" || !phone.trim()) {
    return NextResponse.json({ error: "Phone number is required" }, { status: 400 });
  }

  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json(
      { error: "Name is required" },
      { status: 400 }
    );
  }

  // Prevent adding someone who is already a member (including soft-deleted)
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

  const volunteer = await prisma.volunteer.create({
    data: {
      name: name.trim(),
      email: normalizedEmail,
      phone: phone.trim(),
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
    changes: { name: volunteer.name, email: volunteer.email, phone: volunteer.phone, discordId: volunteer.discordId, role: volunteer.role },
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
