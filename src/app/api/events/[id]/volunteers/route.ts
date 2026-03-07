import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth-helpers";
import { canUserAccessEvent } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: eventId } = await params;
  const session = await getAuthSession(req);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const canEdit = await canUserAccessEvent(session.user.id, eventId, "update");
  if (!canEdit) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { volunteerId, userId, assignedRole } = body;

  if (!volunteerId && !userId) {
    return NextResponse.json(
      { error: "Either volunteerId or userId is required" },
      { status: 400 }
    );
  }

  let resolvedVolunteerId: string;

  if (userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, phone: true },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    let volunteer = await prisma.volunteer.findUnique({
      where: { userId },
    });

    if (!volunteer) {
      volunteer = await prisma.volunteer.create({
        data: {
          name: user.name ?? user.email ?? "Unknown",
          email: user.email,
          phone: user.phone,
          userId: user.id,
        },
      });
    }

    resolvedVolunteerId = volunteer.id;
  } else {
    resolvedVolunteerId = volunteerId;
  }

  const existing = await prisma.eventVolunteer.findUnique({
    where: { eventId_volunteerId: { eventId, volunteerId: resolvedVolunteerId } },
  });

  if (existing) {
    return NextResponse.json(
      { error: "Volunteer already linked to this event" },
      { status: 409 }
    );
  }

  const link = await prisma.eventVolunteer.create({
    data: {
      eventId,
      volunteerId: resolvedVolunteerId,
      assignedRole: assignedRole || null,
    },
    include: {
      volunteer: { select: { id: true, name: true, email: true } },
    },
  });

  await logAudit({
    userId: session.user.id,
    action: "CREATE",
    entityType: "EventVolunteer",
    entityId: link.id,
    entityName: link.volunteer.name,
    changes: { eventId, volunteerId: resolvedVolunteerId, assignedRole },
  });

  return NextResponse.json(link, { status: 201 });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: eventId } = await params;
  const session = await getAuthSession(req);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const canEdit = await canUserAccessEvent(session.user.id, eventId, "update");
  if (!canEdit) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const volunteerId = searchParams.get("volunteerId");

  if (!volunteerId) {
    return NextResponse.json(
      { error: "volunteerId query param is required" },
      { status: 400 }
    );
  }

  const link = await prisma.eventVolunteer.findUnique({
    where: { eventId_volunteerId: { eventId, volunteerId } },
    include: { volunteer: { select: { name: true } } },
  });

  if (!link) {
    return NextResponse.json({ error: "Link not found" }, { status: 404 });
  }

  await prisma.eventVolunteer.delete({ where: { id: link.id } });

  await logAudit({
    userId: session.user.id,
    action: "DELETE",
    entityType: "EventVolunteer",
    entityId: link.id,
    entityName: link.volunteer.name,
    changes: { eventId, volunteerId },
  });

  return NextResponse.json({ success: true });
}
