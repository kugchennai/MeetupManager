/**
 * High-level email trigger functions.
 * Each function gathers data from the database, renders the appropriate template,
 * and sends the email via the core email service.
 * All functions are async and should be awaited (or wrapped in `after()` in API routes).
 */
import { renderAndSend, isEmailConfigured } from "../email";
import { prisma } from "../prisma";
import { generateICS } from "./ics";
import React from "react";

// Templates
import { MemberInvitationEmail } from "./templates/member-invitation";
import { VolunteerPromotionEmail } from "./templates/volunteer-promotion";
import { VolunteerWelcomeEmail } from "./templates/volunteer-welcome";
import { EventCreatedEmail } from "./templates/event-created";
import { EventReminderEmail } from "./templates/event-reminder";
import { TaskAssignedEmail } from "./templates/task-assigned";
import { TaskDueSoonEmail } from "./templates/task-due-soon";
import { TaskOverdueEmail } from "./templates/task-overdue";
import { SpeakerInvitationEmail } from "./templates/speaker-invitation";
import { VenueConfirmedEmail } from "./templates/venue-confirmed";
import { WeeklyDigestEmail } from "./templates/weekly-digest";

// ─── Helpers ──────────────────────────────────────────────────────

function getAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXTAUTH_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  );
}

function formatDate(date: Date | string, timeZone?: string): string {
  return new Date(date).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone,
  });
}

function formatDateTime(date: Date | string, timeZone?: string): string {
  return new Date(date).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
    timeZoneName: "short",
  });
}

// ─── Email Branding ───────────────────────────────────────────────

interface EmailBranding {
  appName: string;
  logoUrl?: string;
  /** Raw base64 data URI of the logo — passed to renderAndSend for CID embedding */
  logoBase64?: string;
  globalTimezone?: string;
}

/** CID identifier used in <img src="cid:..."> and as the attachment CID */
export const LOGO_CID = "company-logo";

/**
 * Fetch meetup name and logo from AppSettings.
 * The light logo is used for emails (dark header background).
 * Returns a CID reference (cid:company-logo) as logoUrl so the image
 * is embedded directly in the email as a MIME attachment.
 * This works in all email clients regardless of whether the app is deployed.
 */
async function getEmailBranding(): Promise<EmailBranding> {
  try {
    const settings = await prisma.appSetting.findMany({
      where: { key: { in: ["meetup_name", "logo_light", "global_timezone"] } },
    });
    const map: Record<string, string> = {};
    for (const s of settings) map[s.key] = s.value;

    const hasLogo = !!map.logo_light;

    return {
      appName: map.meetup_name || "Meetup Manager",
      logoUrl: hasLogo ? `cid:${LOGO_CID}` : undefined,
      logoBase64: map.logo_light || undefined,
      globalTimezone: map.global_timezone || undefined,
    };
  } catch {
    return { appName: "Meetup Manager" };
  }
}

/** Build renderAndSend options with branding (fromName + CID logo attachment) */
function brandingOptions(branding: EmailBranding, extra?: { attachments?: Array<{ filename: string; content: string | Buffer; contentType?: string }>; cc?: string | string[] }) {
  return {
    fromName: branding.appName,
    logoBase64: branding.logoBase64,
    logoCid: LOGO_CID,
    ...extra,
  };
}

// ─── 1. Member Invitation ─────────────────────────────────────────

export async function sendMemberInvitationEmail(
  memberEmail: string,
  memberName: string,
  role: string,
  inviterName: string
): Promise<void> {
  if (!isEmailConfigured()) return;

  const appUrl = getAppUrl();
  const branding = await getEmailBranding();

  try {
    await renderAndSend(
      memberEmail,
      `You've been invited to join the team`,
      "member_invitation",
      React.createElement(MemberInvitationEmail, {
        name: memberName,
        email: memberEmail,
        role,
        inviterName,
        appUrl,
        appName: branding.appName,
        logoUrl: branding.logoUrl,
      }),
      brandingOptions(branding)
    );
  } catch (err) {
    console.error("[Email] Member invitation failed:", err);
  }
}

// ─── 2a. Volunteer Welcome ───────────────────────────────────────

export async function sendVolunteerWelcomeEmail(
  volunteerName: string,
  volunteerEmail: string,
  volunteerRole: string | null,
  inviterName: string
): Promise<void> {
  if (!isEmailConfigured() || !volunteerEmail) return;

  const appUrl = getAppUrl();
  const branding = await getEmailBranding();

  try {
    await renderAndSend(
      volunteerEmail,
      `Welcome to the team, ${volunteerName}!`,
      "volunteer_welcome",
      React.createElement(VolunteerWelcomeEmail, {
        name: volunteerName,
        role: volunteerRole,
        inviterName,
        appUrl,
        appName: branding.appName,
        logoUrl: branding.logoUrl,
      }),
      brandingOptions(branding)
    );
  } catch (err) {
    console.error("[Email] Volunteer welcome failed:", err);
  }
}

// ─── 2b. Volunteer Promotion ─────────────────────────────────────

export async function sendVolunteerPromotionEmail(
  volunteerName: string,
  volunteerEmail: string
): Promise<void> {
  if (!isEmailConfigured() || !volunteerEmail) return;

  const branding = await getEmailBranding();

  try {
    await renderAndSend(
      volunteerEmail,
      `Congratulations! You've been promoted to Member`,
      "volunteer_promotion",
      React.createElement(VolunteerPromotionEmail, {
        name: volunteerName,
        newRole: "Member (Event Lead)",
        permissions: [
          "Create and manage events",
          "Manage speakers, volunteers, and venue partners",
          "Assign and track SOP checklist tasks",
          "View all events (not just assigned ones)",
        ],
        nextSteps: [
          "Sign in with your Google account to access the full dashboard",
          "Check your assigned tasks on the dashboard",
          "Explore the event management tools",
        ],
        appName: branding.appName,
        logoUrl: branding.logoUrl,
      }),
      brandingOptions(branding)
    );
  } catch (err) {
    console.error("[Email] Volunteer promotion failed:", err);
  }
}

// ─── 3. Event Created ────────────────────────────────────────────

export async function sendEventCreatedEmail(eventId: string): Promise<void> {
  if (!isEmailConfigured()) return;

  try {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        createdBy: { select: { name: true } },
        members: {
          include: {
            user: { select: { email: true, name: true } },
          },
        },
      },
    });

    if (!event) return;

    const appUrl = getAppUrl();
    const eventUrl = `${appUrl}/events/${eventId}`;
    const branding = await getEmailBranding();

    // Collect event member emails
    const recipientSet = new Set<string>();
    event.members.forEach((m) => {
      if (m.user.email) recipientSet.add(m.user.email);
    });

    // Also notify all Members (EVENT_LEAD), Admins, and Super Admins
    const globalUsers = await prisma.user.findMany({
      where: {
        globalRole: { in: ["EVENT_LEAD", "ADMIN", "SUPER_ADMIN"] },
        deletedAt: null,
      },
      select: { email: true },
    });
    globalUsers.forEach((u) => {
      if (u.email) recipientSet.add(u.email);
    });

    const recipients = Array.from(recipientSet);
    if (recipients.length === 0) return;

    await renderAndSend(
      recipients,
      `New event: ${event.title}`,
      "event_created",
      React.createElement(EventCreatedEmail, {
        eventTitle: event.title,
        date: formatDateTime(event.date, branding.globalTimezone),
        endDate: formatDateTime(event.endDate, branding.globalTimezone),
        venue: event.venue,
        eventUrl,
        createdBy: event.createdBy.name ?? "Team Member",
        appName: branding.appName,
        logoUrl: branding.logoUrl,
      }),
      brandingOptions(branding)
    );
  } catch (err) {
    console.error("[Email] Event created trigger error:", err);
  }
}

// ─── 4. Event Reminder ──────────────────────────────────────────

export async function sendEventReminderEmail(eventId: string): Promise<void> {
  if (!isEmailConfigured()) return;

  try {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        members: {
          include: {
            user: { select: { email: true } },
          },
        },
        speakers: {
          where: { status: "CONFIRMED" },
          include: {
            speaker: { select: { email: true } },
          },
        },
      },
    });

    if (!event) return;

    const appUrl = getAppUrl();
    const eventUrl = `${appUrl}/events/${eventId}`;
    const now = new Date();
    const eventDate = new Date(event.date);
    const daysUntil = Math.ceil((eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const branding = await getEmailBranding();

    // Collect all recipient emails
    const emails = new Set<string>();
    event.members.forEach((m) => { if (m.user.email) emails.add(m.user.email); });
    event.speakers.forEach((s) => { if (s.speaker.email) emails.add(s.speaker.email); });

    const recipients = Array.from(emails);
    if (recipients.length === 0) return;

    // Generate ICS attachment
    const icsContent = generateICS({
      title: event.title,
      description: event.description ?? undefined,
      startDate: eventDate,
      endDate: new Date(event.endDate),
      location: event.venue ?? undefined,
      url: eventUrl,
    });

    await renderAndSend(
      recipients,
      `Reminder: ${event.title} is in ${daysUntil} day${daysUntil !== 1 ? "s" : ""}`,
      "event_reminder",
      React.createElement(EventReminderEmail, {
        eventTitle: event.title,
        date: formatDateTime(event.date, branding.globalTimezone),
        endDate: formatDateTime(event.endDate, branding.globalTimezone),
        venue: event.venue,
        eventUrl,
        daysUntil,
        appName: branding.appName,
        logoUrl: branding.logoUrl,
      }),
      brandingOptions(branding, {
        attachments: [
          {
            filename: "event.ics",
            content: icsContent,
            contentType: "text/calendar",
          },
        ],
      })
    );
  } catch (err) {
    console.error("[Email] Event reminder trigger error:", err);
  }
}

// ─── 5. Task Assigned ────────────────────────────────────────────

export async function sendTaskAssignedEmail(
  taskId: string,
  assignedByName?: string
): Promise<void> {
  if (!isEmailConfigured()) return;

  try {
    const task = await prisma.sOPTask.findUnique({
      where: { id: taskId },
      include: {
        assignee: { select: { email: true, name: true } },
        volunteerAssignee: { select: { email: true, name: true } },
        checklist: {
          include: {
            event: { select: { id: true, title: true } },
          },
        },
      },
    });

    if (!task) return;

    const recipientEmail = task.assignee?.email ?? task.volunteerAssignee?.email;
    if (!recipientEmail) return;

    const appUrl = getAppUrl();
    const taskUrl = `${appUrl}/events/${task.checklist.event.id}`;
    const branding = await getEmailBranding();

    await renderAndSend(
      recipientEmail,
      `Task assigned: ${task.title}`,
      "task_assigned",
      React.createElement(TaskAssignedEmail, {
        taskTitle: task.title,
        priority: task.priority,
        deadline: task.deadline ? formatDate(task.deadline, branding.globalTimezone) : null,
        eventName: task.checklist.event.title,
        taskUrl,
        assignedBy: assignedByName,
        appName: branding.appName,
        logoUrl: branding.logoUrl,
      }),
      brandingOptions(branding)
    );
  } catch (err) {
    console.error("[Email] Task assigned trigger error:", err);
  }
}

// ─── 6. Task Due Soon ───────────────────────────────────────────

export async function sendTaskDueSoonEmail(
  taskId: string,
  daysRemaining: number
): Promise<void> {
  if (!isEmailConfigured()) return;

  try {
    const task = await prisma.sOPTask.findUnique({
      where: { id: taskId },
      include: {
        assignee: { select: { email: true } },
        volunteerAssignee: { select: { email: true } },
        checklist: {
          include: {
            event: { select: { id: true, title: true } },
          },
        },
      },
    });

    if (!task || !task.deadline) return;

    const recipientEmail = task.assignee?.email ?? task.volunteerAssignee?.email;
    if (!recipientEmail) return;

    const appUrl = getAppUrl();
    const taskUrl = `${appUrl}/events/${task.checklist.event.id}`;
    const branding = await getEmailBranding();

    await renderAndSend(
      recipientEmail,
      `Task due soon: ${task.title}`,
      "task_due_soon",
      React.createElement(TaskDueSoonEmail, {
        taskTitle: task.title,
        deadline: formatDate(task.deadline, branding.globalTimezone),
        daysRemaining,
        eventName: task.checklist.event.title,
        taskUrl,
        priority: task.priority,
        appName: branding.appName,
        logoUrl: branding.logoUrl,
      }),
      brandingOptions(branding)
    );
  } catch (err) {
    console.error("[Email] Task due soon trigger error:", err);
  }
}

// ─── 7. Task Overdue ────────────────────────────────────────────

export async function sendTaskOverdueEmail(
  taskId: string,
  overdueDays: number,
  ccEventLead?: boolean
): Promise<void> {
  if (!isEmailConfigured()) return;

  try {
    const task = await prisma.sOPTask.findUnique({
      where: { id: taskId },
      include: {
        assignee: { select: { email: true } },
        volunteerAssignee: { select: { email: true } },
        checklist: {
          include: {
            event: {
              select: {
                id: true,
                title: true,
                members: {
                  where: { eventRole: "LEAD" },
                  include: { user: { select: { email: true } } },
                },
              },
            },
          },
        },
      },
    });

    if (!task || !task.deadline) return;

    const recipientEmail = task.assignee?.email ?? task.volunteerAssignee?.email;
    if (!recipientEmail) return;

    const appUrl = getAppUrl();
    const taskUrl = `${appUrl}/events/${task.checklist.event.id}`;
    const branding = await getEmailBranding();

    // Get event lead email for CC
    const eventLeadEmails = ccEventLead
      ? task.checklist.event.members
        .map((m) => m.user.email)
        .filter((email): email is string => !!email && email !== recipientEmail)
      : undefined;

    await renderAndSend(
      recipientEmail,
      `OVERDUE: ${task.title}`,
      "task_overdue",
      React.createElement(TaskOverdueEmail, {
        taskTitle: task.title,
        deadline: formatDate(task.deadline, branding.globalTimezone),
        overdueDays,
        eventName: task.checklist.event.title,
        taskUrl,
        priority: task.priority,
        isEscalation: ccEventLead && (eventLeadEmails?.length ?? 0) > 0,
        appName: branding.appName,
        logoUrl: branding.logoUrl,
      }),
      brandingOptions(branding, { cc: eventLeadEmails })
    );
  } catch (err) {
    console.error("[Email] Task overdue trigger error:", err);
  }
}

// ─── 8. Speaker Invitation ──────────────────────────────────────

export async function sendSpeakerInvitationEmail(
  eventSpeakerId: string
): Promise<void> {
  if (!isEmailConfigured()) return;

  try {
    const link = await prisma.eventSpeaker.findUnique({
      where: { id: eventSpeakerId },
      include: {
        speaker: { select: { name: true, email: true, topic: true } },
        event: { select: { id: true, title: true, date: true, endDate: true, venue: true } },
      },
    });

    if (!link || !link.speaker.email) return;

    const appUrl = getAppUrl();
    const eventUrl = `${appUrl}/events/${link.event.id}`;
    const icsContent = generateICS({
      title: link.event.title,
      description: link.speaker.topic
        ? `Speaker invitation for ${link.event.title}. Topic: ${link.speaker.topic}`
        : `Speaker invitation for ${link.event.title}`,
      startDate: link.event.date,
      endDate: link.event.endDate,
      location: link.event.venue ?? undefined,
      url: eventUrl,
    });

    const branding = await getEmailBranding();

    await renderAndSend(
      link.speaker.email,
      `Speaker invitation: ${link.event.title}`,
      "speaker_invitation",
      React.createElement(SpeakerInvitationEmail, {
        speakerName: link.speaker.name,
        eventTitle: link.event.title,
        topic: link.speaker.topic,
        date: formatDateTime(link.event.date, branding.globalTimezone),
        endDate: formatDateTime(link.event.endDate, branding.globalTimezone),
        venue: link.event.venue,
        appName: branding.appName,
        logoUrl: branding.logoUrl,
      }),
      brandingOptions(branding, {
        attachments: [
          {
            filename: "speaker-invitation.ics",
            content: icsContent,
            contentType: "text/calendar",
          },
        ],
      })
    );
  } catch (err) {
    console.error("[Email] Speaker invitation trigger error:", err);
  }
}

// ─── 9. Venue Confirmed ─────────────────────────────────────────

export async function sendVenueConfirmedEmail(
  eventVenuePartnerId: string,
  eventId: string
): Promise<void> {
  if (!isEmailConfigured()) return;

  try {
    const link = await prisma.eventVenuePartner.findUnique({
      where: { id: eventVenuePartnerId },
      include: {
        venuePartner: { select: { name: true, address: true, capacity: true, contactName: true } },
      },
    });

    if (!link) return;

    // Get event lead emails
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        members: {
          where: { eventRole: "LEAD" },
          include: { user: { select: { email: true } } },
        },
      },
    });

    if (!event) return;

    const recipients = event.members
      .map((m) => m.user.email)
      .filter((email): email is string => !!email);

    if (recipients.length === 0) return;

    const branding = await getEmailBranding();

    await renderAndSend(
      recipients,
      `Venue confirmed: ${link.venuePartner.name} for ${event.title}`,
      "venue_confirmed",
      React.createElement(VenueConfirmedEmail, {
        venueName: link.venuePartner.name,
        address: link.venuePartner.address,
        capacity: link.venuePartner.capacity,
        confirmationDate: formatDate(new Date(), branding.globalTimezone),
        eventTitle: event.title,
        contactName: link.venuePartner.contactName,
        appName: branding.appName,
        logoUrl: branding.logoUrl,
      }),
      brandingOptions(branding)
    );
  } catch (err) {
    console.error("[Email] Venue confirmed trigger error:", err);
  }
}

// ─── 10. Weekly Digest ──────────────────────────────────────────

export async function sendWeeklyDigestEmail(userId: string): Promise<void> {
  if (!isEmailConfigured()) return;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    });

    if (!user?.email) return;

    const appUrl = getAppUrl();
    const now = new Date();
    const branding = await getEmailBranding();

    // Get assigned incomplete tasks
    const assignedTasks = await prisma.sOPTask.findMany({
      where: {
        status: { not: "DONE" },
        OR: [
          { assigneeId: userId },
          { ownerId: userId },
        ],
      },
      include: {
        checklist: {
          include: { event: { select: { id: true, title: true } } },
        },
      },
      orderBy: { deadline: "asc" },
      take: 20,
    });

    // Get overdue tasks
    const overdueTasks = assignedTasks.filter(
      (t) => t.deadline && new Date(t.deadline) < now
    );

    // Get upcoming events (next 14 days)
    const twoWeeksFromNow = new Date(now);
    twoWeeksFromNow.setDate(twoWeeksFromNow.getDate() + 14);

    const upcomingEvents = await prisma.event.findMany({
      where: {
        date: { gte: now, lte: twoWeeksFromNow },
        status: { in: ["SCHEDULED", "LIVE"] },
      },
      select: { id: true, title: true, date: true, endDate: true, venue: true },
      orderBy: { date: "asc" },
      take: 5,
    });

    // Summary counts
    const totalTasks = await prisma.sOPTask.count({
      where: {
        status: { not: "DONE" },
        OR: [
          { assigneeId: userId },
          { ownerId: userId },
        ],
      },
    });

    const completedTasks = await prisma.sOPTask.count({
      where: {
        status: "DONE",
        OR: [
          { assigneeId: userId },
          { ownerId: userId },
        ],
        completedAt: { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) },
      },
    });

    const totalEvents = await prisma.event.count({
      where: { status: { in: ["SCHEDULED", "LIVE"] } },
    });

    await renderAndSend(
      user.email,
      `Weekly digest: ${totalTasks} active tasks, ${upcomingEvents.length} upcoming events`,
      "weekly_digest",
      React.createElement(WeeklyDigestEmail, {
        userName: user.name ?? "Team Member",
        assignedTasks: assignedTasks.map((t) => ({
          title: t.title,
          eventTitle: t.checklist.event.title,
          priority: t.priority,
          deadline: t.deadline ? formatDate(t.deadline, branding.globalTimezone) : null,
          taskUrl: `${appUrl}/events/${t.checklist.event.id}`,
        })),
        overdueTasks: overdueTasks.map((t) => ({
          title: t.title,
          eventTitle: t.checklist.event.title,
          priority: t.priority,
          deadline: t.deadline ? formatDate(t.deadline, branding.globalTimezone) : null,
          taskUrl: `${appUrl}/events/${t.checklist.event.id}`,
        })),
        upcomingEvents: upcomingEvents.map((e) => ({
          title: e.title,
          date: formatDateTime(e.date, branding.globalTimezone),
          endDate: formatDateTime(e.endDate, branding.globalTimezone),
          venue: e.venue,
          eventUrl: `${appUrl}/events/${e.id}`,
        })),
        summary: {
          totalTasks,
          completedTasks,
          totalEvents,
          upcomingEventsCount: upcomingEvents.length,
        },
        appUrl,
        appName: branding.appName,
        logoUrl: branding.logoUrl,
      }),
      brandingOptions(branding)
    );
  } catch (err) {
    console.error("[Email] Weekly digest trigger error:", err);
  }
}
