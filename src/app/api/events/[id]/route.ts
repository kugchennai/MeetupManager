import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth-helpers";
import { canUserAccessEvent } from "@/lib/permissions";
import { logAudit, diffChanges } from "@/lib/audit";
import { sendEventCreatedEmail } from "@/lib/emails/triggers";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getAuthSession(req);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const event = await prisma.event.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, name: true, image: true, email: true } },
      members: {
        include: {
          user: { select: { id: true, name: true, image: true, email: true } },
        },
      },
      speakers: {
        include: {
          speaker: true,
          owner: { select: { id: true, name: true, image: true } },
        },
      },
      volunteers: {
        include: {
          volunteer: true,
          owner: { select: { id: true, name: true, image: true } },
        },
      },
      venuePartners: {
        include: {
          venuePartner: true,
          owner: { select: { id: true, name: true, image: true } },
        },
      },
      checklists: {
        include: {
          tasks: {
            include: {
              owner: { select: { id: true, name: true, image: true } },
              assignee: { select: { id: true, name: true, image: true } },
              volunteerAssignee: { select: { id: true, name: true } },
            },
            orderBy: { sortOrder: "asc" },
          },
        },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!event) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const venueRequestTemplateKeys = event.venuePartners.map((vp) => `venue_request:${vp.id}`);
  const venueRequestLogs = venueRequestTemplateKeys.length
    ? await prisma.emailLog.findMany({
        where: {
          template: { in: venueRequestTemplateKeys },
          status: { in: ["PENDING", "SENT"] },
        },
        orderBy: { createdAt: "desc" },
        select: {
          template: true,
          status: true,
          sentAt: true,
          createdAt: true,
          to: true,
          subject: true,
        },
      })
    : [];
  const requestByTemplate = new Map<string, (typeof venueRequestLogs)[number]>();
  for (const log of venueRequestLogs) {
    if (!requestByTemplate.has(log.template)) {
      requestByTemplate.set(log.template, log);
    }
  }

  const eventWithVenueRequestState = {
    ...event,
    venuePartners: event.venuePartners.map((vp) => {
      const request = requestByTemplate.get(`venue_request:${vp.id}`);
      const gmailQuery = request
        ? `to:${request.to} subject:"${request.subject}"`
        : null;
      return {
        ...vp,
        venueRequestSent: !!request,
        venueRequestSentAt: request?.sentAt ?? request?.createdAt ?? null,
        venueRequestGmailUrl: gmailQuery
          ? `https://mail.google.com/mail/u/0/#search/${encodeURIComponent(gmailQuery)}`
          : null,
      };
    }),
  };

  return NextResponse.json(eventWithVenueRequestState);
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

  const canEdit = await canUserAccessEvent(session.user.id, id, "update");
  if (!canEdit) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { title, description, date, endDate, venue, pageLink, status } = body;

  // Validate that end date is after start date if both dates are being updated
  if (date !== undefined && endDate !== undefined) {
    const startDate = new Date(date);
    const endDateParsed = new Date(endDate);
    if (endDateParsed <= startDate) {
      return NextResponse.json({ error: "End time must be greater than start time" }, { status: 400 });
    }
  }
  // If only one date is being updated, check against the existing date
  else if (date !== undefined || endDate !== undefined) {
    const existingEvent = await prisma.event.findUnique({ where: { id }, select: { date: true, endDate: true } });
    if (!existingEvent) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    
    const finalStartDate = date !== undefined ? new Date(date) : existingEvent.date;
    const finalEndDate = endDate !== undefined ? new Date(endDate) : existingEvent.endDate;
    
    if (finalEndDate <= finalStartDate) {
      return NextResponse.json({ error: "End time must be greater than start time" }, { status: 400 });
    }
  }

  const before = await prisma.event.findUnique({ where: { id } });
  if (!before) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const event = await prisma.event.update({
    where: { id },
    data: {
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description }),
      ...(date !== undefined && { date: new Date(date) }),
      ...(endDate !== undefined && { endDate: new Date(endDate) }),
      ...(venue !== undefined && { venue }),
      ...(pageLink !== undefined && { pageLink: pageLink || null }),
      ...(status !== undefined && { status }),
    },
    include: {
      createdBy: { select: { id: true, name: true, image: true } },
    },
  });

  const changes = diffChanges(
    { title: before.title, description: before.description, date: before.date, endDate: before.endDate, venue: before.venue, pageLink: before.pageLink, status: before.status },
    { title: event.title, description: event.description, date: event.date, endDate: event.endDate, venue: event.venue, pageLink: event.pageLink, status: event.status }
  );

  if (Object.keys(changes).length > 0) {
    await logAudit({
      userId: session.user.id,
      action: "UPDATE",
      entityType: "Event",
      entityId: id,
      entityName: event.title,
      changes,
    });
  }

  // Notify team when event becomes SCHEDULED
  if (status === "SCHEDULED" && before.status !== "SCHEDULED") {
    await sendEventCreatedEmail(id);
  }

  return NextResponse.json(event);
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

  // Only event creator, ADMIN (for their own events), or SUPER_ADMIN can delete events
  const eventToDelete = await prisma.event.findUnique({ 
    where: { id }, 
    select: { title: true, createdById: true } 
  });

  if (!eventToDelete) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { globalRole: true },
  });

  const isCreator = eventToDelete.createdById === session.user.id;
  const isSuperAdmin = user?.globalRole === "SUPER_ADMIN";
  const isAdmin = user?.globalRole === "ADMIN";

  // Allow: Super Admin (any event), or Creator (if they are Admin or Super Admin)
  const canDelete = isSuperAdmin || (isCreator && (isAdmin || isSuperAdmin));

  if (!canDelete) {
    return NextResponse.json({ 
      error: "Forbidden: Only the event creator (if Admin or Super Admin) or Super Admin can delete this event" 
    }, { status: 403 });
  }

  await prisma.event.delete({ where: { id } });

  await logAudit({
    userId: session.user.id,
    action: "DELETE",
    entityType: "Event",
    entityId: id,
    entityName: eventToDelete?.title,
  });

  return NextResponse.json({ success: true });
}
