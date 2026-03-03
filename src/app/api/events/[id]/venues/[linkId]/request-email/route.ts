import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth-helpers";
import { canUserAccessEvent, hasMinimumRole } from "@/lib/permissions";
import { sendEmail } from "@/lib/email";
import { logAudit } from "@/lib/audit";
import type { GlobalRole } from "@/generated/prisma/enums";

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; linkId: string }> }
) {
  const { id: eventId, linkId } = await params;
  const session = await getAuthSession(req);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userRole = session.user.globalRole as GlobalRole;
  if (!hasMinimumRole(userRole, "ADMIN")) {
    return NextResponse.json(
      { error: "Forbidden: ADMIN or SUPER_ADMIN required" },
      { status: 403 }
    );
  }

  const canEdit = await canUserAccessEvent(session.user.id, eventId, "update");
  if (!canEdit) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";

  if (!subject || !message) {
    return NextResponse.json(
      { error: "subject and message are required" },
      { status: 400 }
    );
  }

  const link = await prisma.eventVenuePartner.findUnique({
    where: { id: linkId },
    include: {
      event: { select: { id: true, title: true } },
      venuePartner: { select: { name: true, email: true } },
    },
  });

  if (!link || link.eventId !== eventId) {
    return NextResponse.json({ error: "Venue link not found" }, { status: 404 });
  }

  if (!link.venuePartner.email) {
    return NextResponse.json(
      { error: "Venue partner email is missing" },
      { status: 400 }
    );
  }

  const templateKey = `venue_request:${linkId}`;
  const alreadySent = await prisma.emailLog.findFirst({
    where: {
      template: templateKey,
      status: { in: ["PENDING", "SENT"] },
    },
    select: { id: true },
  });

  if (alreadySent) {
    return NextResponse.json(
      { error: "A venue request email was already sent for this event and venue." },
      { status: 409 }
    );
  }

  const meetupNameSetting = await prisma.appSetting.findUnique({
    where: { key: "meetup_name" },
    select: { value: true },
  });
  const cleanedMeetupName = (meetupNameSetting?.value || "Meetup")
    .replace(/\s*manager\s*$/i, "")
    .trim();
  const fromName = cleanedMeetupName || "Meetup";

  const html = `<div style="font-family:Arial,sans-serif;white-space:pre-wrap;line-height:1.5;">${escapeHtml(message)}</div>`;
  const result = await sendEmail({
    to: link.venuePartner.email,
    subject,
    html,
    text: message,
    template: templateKey,
    fromName,
  });

  if (!result.success) {
    return NextResponse.json(
      { error: result.error ?? "Failed to send email" },
      { status: 500 }
    );
  }

  await logAudit({
    userId: session.user.id,
    action: "UPDATE",
    entityType: "EventVenuePartner",
    entityId: linkId,
    entityName: link.venuePartner.name,
    changes: {
      venueRequestEmail: {
        to: link.venuePartner.email,
        subject,
        status: "SENT",
      },
    },
  });

  return NextResponse.json({
    success: true,
    sentTo: link.venuePartner.email,
  });
}
