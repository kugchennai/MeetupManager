import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth-helpers";
import { canUserAccessEvent, hasMinimumRole } from "@/lib/permissions";
import { sendEmail } from "@/lib/email";
import { logAudit } from "@/lib/audit";
import type { GlobalRole } from "@/generated/prisma/enums";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function logoAttachmentFromDataUri(dataUri: string, cid: string) {
  const match = dataUri.match(/^data:(image\/[a-z+]+);base64,(.+)$/i);
  if (!match) return null;

  return {
    filename: `logo.${match[1].split("/")[1].replace("+xml", "")}`,
    content: Buffer.from(match[2], "base64"),
    contentType: match[1],
    cid,
  };
}

function parseCcEmails(value: unknown): string[] {
  if (typeof value === "string") {
    return Array.from(
      new Set(
        value
          .split(/[,\n]/)
          .map((email) => email.trim().toLowerCase())
          .filter(Boolean)
      )
    );
  }

  if (Array.isArray(value)) {
    return Array.from(
      new Set(
        value
          .filter((entry): entry is string => typeof entry === "string")
          .map((email) => email.trim().toLowerCase())
          .filter(Boolean)
      )
    );
  }

  return [];
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
  const ccEmails = parseCcEmails(body.cc);
  const invalidCc = ccEmails.find((email) => !EMAIL_REGEX.test(email));

  if (!subject || !message) {
    return NextResponse.json(
      { error: "subject and message are required" },
      { status: 400 }
    );
  }
  if (invalidCc) {
    return NextResponse.json(
      { error: `Invalid CC email: ${invalidCc}` },
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

  const [meetupNameSetting, logoLightSetting, eventLeads, adminUsers] = await Promise.all([
    prisma.appSetting.findUnique({ where: { key: "meetup_name" }, select: { value: true } }),
    prisma.appSetting.findUnique({ where: { key: "logo_light" }, select: { value: true } }),
    prisma.eventMember.findMany({
      where: { eventId, eventRole: { in: ["LEAD", "ORGANIZER"] } },
      include: { user: { select: { id: true, name: true, phone: true, email: true } } },
    }),
    prisma.user.findMany({
      where: { globalRole: "ADMIN", deletedAt: null },
      select: { id: true, name: true, phone: true, email: true },
    }),
  ]);

  const cleanedMeetupName = (meetupNameSetting?.value || "Meetup")
    .replace(/\s*manager\s*$/i, "")
    .trim();
  const fromName = cleanedMeetupName || "Meetup";

  // Build deduplicated contact list (event leads first, then admins)
  const contactMap = new Map<string, { name: string | null; phone: string | null; role: string }>();
  for (const m of eventLeads) {
    contactMap.set(m.user.id, { name: m.user.name, phone: m.user.phone, role: "Event Lead" });
  }
  for (const u of adminUsers) {
    if (!contactMap.has(u.id)) {
      contactMap.set(u.id, { name: u.name, phone: u.phone, role: "Admin" });
    }
  }
  const contacts = Array.from(contactMap.values()).filter((c) => c.phone);

  const logoCid = "venue-request-logo";
  const logoAttachment = logoLightSetting?.value
    ? logoAttachmentFromDataUri(logoLightSetting.value, logoCid)
    : null;

  const contactsHtml = contacts.length > 0
    ? `<div style="margin-top:24px;padding-top:16px;border-top:1px solid #e5e7eb;font-family:Arial,sans-serif;">` +
      `<p style="margin:0 0 10px 0;font-size:14px;color:#374151;">If you have any doubts, please feel free to contact us:</p>` +
      contacts.map((c) =>
        `<p style="margin:0 0 4px 0;font-size:13px;color:#4b5563;">` +
        `<strong>${escapeHtml(c.name ?? "Team Member")}</strong>` +
        ` &mdash; ${escapeHtml(c.phone!)}` +
        `</p>`
      ).join("") +
      `</div>`
    : "";

  const html = [
    `<div style="font-family:Arial,sans-serif;white-space:pre-wrap;line-height:1.5;">${escapeHtml(message)}</div>`,
    contactsHtml,
    logoAttachment
      ? `<div style="margin-top:16px;"><img src="cid:${logoCid}" alt="${escapeHtml(fromName)} logo" style="max-height:48px;max-width:220px;display:block;" /></div>`
      : "",
  ].join("");

  const result = await sendEmail({
    to: link.venuePartner.email,
    cc: ccEmails.length > 0 ? ccEmails : undefined,
    subject,
    html,
    text: message,
    template: templateKey,
    fromName,
    attachments: logoAttachment ? [logoAttachment] : undefined,
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
        cc: ccEmails,
        subject,
        status: "SENT",
      },
    },
  });

  return NextResponse.json({
    success: true,
    sentTo: link.venuePartner.email,
    cc: ccEmails,
  });
}
