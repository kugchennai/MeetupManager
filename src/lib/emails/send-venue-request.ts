import { prisma } from "@/lib/prisma";
import { hasMinimumRole } from "@/lib/permissions";
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

export type SendVenueRequestInput = {
  subject: string;
  message: string;
  cc?: string | string[];
};

export type SendVenueRequestResult =
  | { ok: true; sentTo: string; cc: string[] }
  | { ok: false; status: number; error: string };

export async function sendVenueRequestEmail(
  user: { id: string; globalRole: string },
  eventId: string,
  linkId: string,
  body: SendVenueRequestInput
): Promise<SendVenueRequestResult> {
  const link = await prisma.eventVenuePartner.findUnique({
    where: { id: linkId },
    include: {
      event: { select: { id: true, title: true, createdById: true } },
      venuePartner: { select: { name: true, email: true } },
    },
  });

  if (!link || link.eventId !== eventId) {
    return { ok: false, status: 404, error: "Venue link not found" };
  }

  const isEventCreator = link.event.createdById === user.id;
  const isAdmin = hasMinimumRole(user.globalRole as GlobalRole, "ADMIN");

  if (!isEventCreator && !isAdmin) {
    return { ok: false, status: 403, error: "Forbidden" };
  }

  const subject = body.subject.trim();
  const message = body.message.trim();
  const ccEmails = parseCcEmails(body.cc);
  const invalidCc = ccEmails.find((email) => !EMAIL_REGEX.test(email));

  if (!subject || !message) {
    return { ok: false, status: 400, error: "subject and message are required" };
  }
  if (invalidCc) {
    return { ok: false, status: 400, error: `Invalid CC email: ${invalidCc}` };
  }

  if (!link.venuePartner.email) {
    return { ok: false, status: 400, error: "Venue partner email is missing" };
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
    return {
      ok: false,
      status: 409,
      error: "A venue request email was already sent for this event and venue.",
    };
  }

  const [meetupNameSetting, logoDarkSetting] = await Promise.all([
    prisma.appSetting.findUnique({ where: { key: "meetup_name" }, select: { value: true } }),
    prisma.appSetting.findUnique({ where: { key: "logo_dark" }, select: { value: true } }),
  ]);

  const cleanedMeetupName = (meetupNameSetting?.value || "Meetup")
    .replace(/\s*manager\s*$/i, "")
    .trim();
  const fromName = cleanedMeetupName || "Meetup";

  const logoCid = "venue-request-logo";
  const logoAttachment = logoDarkSetting?.value
    ? logoAttachmentFromDataUri(logoDarkSetting.value, logoCid)
    : null;

  const html = [
    `<div style="font-family:Arial,sans-serif;white-space:pre-wrap;line-height:1.5;">${escapeHtml(message)}</div>`,
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
    return { ok: false, status: 500, error: result.error ?? "Failed to send email" };
  }

  await logAudit({
    userId: user.id,
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

  return { ok: true, sentTo: link.venuePartner.email, cc: ccEmails };
}
