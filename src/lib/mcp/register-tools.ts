import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import { prisma } from "@/lib/prisma";
import {
  canUserAccessEvent,
  getAssignedEventIds,
  hasMinimumRole,
} from "@/lib/permissions";
import { createEvent } from "@/lib/events/create-event";
import { updateSopTask } from "@/lib/tasks/update-task";
import { sendVenueRequestEmail } from "@/lib/emails/send-venue-request";
import {
  sendEventCreatedEmail,
  sendSpeakerInvitationEmail,
  sendTaskAssignedEmail,
} from "@/lib/emails/triggers";
import { isEmailConfigured } from "@/lib/email";
import { roleOf, userFromAuth, type McpSessionUser } from "./session";
import { mcpError, mcpJson } from "./result";

const TASK_STATUSES = ["TODO", "IN_PROGRESS", "BLOCKED", "DONE"] as const;
const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

type ToolCtx = { http?: { authInfo?: Parameters<typeof userFromAuth>[0] } };

function requireUser(ctx: ToolCtx): McpSessionUser | ReturnType<typeof mcpError> {
  const user = userFromAuth(ctx.http?.authInfo);
  if (!user) return mcpError("Unauthorized", 401);
  return user;
}

function isUser(value: McpSessionUser | ReturnType<typeof mcpError>): value is McpSessionUser {
  return "id" in value;
}

export function registerMeetupTools(server: McpServer) {
  server.registerTool(
    "whoami",
    {
      title: "Who am I",
      description: "Return the authenticated Meetup Manager user and role.",
      inputSchema: z.object({}),
    },
    async (_args, ctx) => {
      const user = requireUser(ctx);
      if (!isUser(user)) return user;
      const minDurationSetting = await prisma.appSetting.findUnique({
        where: { key: "min_event_duration" },
      });
      const minEventDuration = minDurationSetting ? parseInt(minDurationSetting.value, 10) : 4;
      return mcpJson({
        id: user.id,
        name: user.name,
        email: user.email,
        globalRole: user.globalRole,
        minEventDurationHours: Number.isFinite(minEventDuration) ? minEventDuration : 4,
      });
    }
  );

  server.registerTool(
    "list_sop_templates",
    {
      title: "List SOP templates",
      description: "List SOP templates. Use a templateId when creating an event.",
      inputSchema: z.object({}),
    },
    async (_args, ctx) => {
      const user = requireUser(ctx);
      if (!isUser(user)) return user;
      const templates = await prisma.sOPTemplate.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true, description: true },
      });
      return mcpJson(templates);
    }
  );

  server.registerTool(
    "list_events",
    {
      title: "List events",
      description: "List meetup events. Volunteers only see assigned events.",
      inputSchema: z.object({
        filter: z.enum(["upcoming", "past", "all"]).optional().describe("Default upcoming"),
      }),
    },
    async ({ filter }, ctx) => {
      const user = requireUser(ctx);
      if (!isUser(user)) return user;
      const assignedEventIds = await getAssignedEventIds(user.id, roleOf(user));
      const now = new Date();
      const dateFilter =
        filter === "past"
          ? { date: { lt: now } }
          : filter === "all"
            ? {}
            : { date: { gte: now } };

      const events = await prisma.event.findMany({
        where: {
          ...dateFilter,
          ...(assignedEventIds !== null ? { id: { in: assignedEventIds } } : {}),
        },
        select: {
          id: true,
          title: true,
          date: true,
          endDate: true,
          venue: true,
          status: true,
          _count: { select: { speakers: true, volunteers: true, checklists: true } },
        },
        orderBy: { date: "desc" },
        take: 50,
      });
      return mcpJson(events);
    }
  );

  server.registerTool(
    "get_event",
    {
      title: "Get event",
      description: "Get event details including SOP checklists, speakers, venues, and members.",
      inputSchema: z.object({
        eventId: z.string(),
      }),
    },
    async ({ eventId }, ctx) => {
      const user = requireUser(ctx);
      if (!isUser(user)) return user;
      if (!(await canUserAccessEvent(user.id, eventId, "read"))) {
        return mcpError("Forbidden", 403);
      }
      const event = await prisma.event.findUnique({
        where: { id: eventId },
        include: {
          members: {
            include: { user: { select: { id: true, name: true, email: true, globalRole: true } } },
          },
          speakers: { include: { speaker: { select: { id: true, name: true, email: true, topic: true } } } },
          volunteers: { include: { volunteer: { select: { id: true, name: true, email: true, role: true } } } },
          venuePartners: {
            include: { venuePartner: { select: { id: true, name: true, email: true, address: true } } },
          },
          checklists: {
            include: {
              tasks: {
                include: {
                  assignee: { select: { id: true, name: true, email: true } },
                  volunteerAssignee: { select: { id: true, name: true } },
                },
                orderBy: { sortOrder: "asc" },
              },
            },
            orderBy: { sortOrder: "asc" },
          },
        },
      });
      if (!event) return mcpError("Event not found", 404);
      return mcpJson(event);
    }
  );

  server.registerTool(
    "create_event",
    {
      title: "Create event",
      description:
        "Create a meetup event and generate SOP checklists from a template. Requires EVENT_LEAD or higher. Use list_sop_templates first to get templateId. End time must be after start time, and duration must meet the app minimum (see whoami.minEventDurationHours, default 4 hours).",
      inputSchema: z.object({
        title: z.string(),
        date: z.string().describe("ISO 8601 UTC start datetime"),
        endDate: z.string().describe("ISO 8601 UTC end datetime"),
        templateId: z.string(),
        description: z.string().optional(),
        venue: z.string().optional(),
        pageLink: z.string().optional(),
      }),
    },
    async (input, ctx) => {
      const user = requireUser(ctx);
      if (!isUser(user)) return user;
      if (!hasMinimumRole(roleOf(user), "EVENT_LEAD")) {
        return mcpError("Forbidden: Event Lead role required", 403);
      }
      const result = await createEvent(user.id, input);
      if (!result.ok) return mcpError(result.error, result.status);
      return mcpJson({ message: "Event created", event: result.event });
    }
  );

  server.registerTool(
    "list_sop_checklists",
    {
      title: "List SOP checklists",
      description: "List SOP checklists and tasks for an event.",
      inputSchema: z.object({
        eventId: z.string(),
      }),
    },
    async ({ eventId }, ctx) => {
      const user = requireUser(ctx);
      if (!isUser(user)) return user;
      if (!(await canUserAccessEvent(user.id, eventId, "read"))) {
        return mcpError("Forbidden", 403);
      }
      const checklists = await prisma.sOPChecklist.findMany({
        where: { eventId },
        include: {
          tasks: {
            include: {
              assignee: { select: { id: true, name: true, email: true } },
              volunteerAssignee: { select: { id: true, name: true } },
            },
            orderBy: { sortOrder: "asc" },
          },
        },
        orderBy: { sortOrder: "asc" },
      });
      return mcpJson(checklists);
    }
  );

  server.registerTool(
    "get_sop_checklist",
    {
      title: "Get SOP checklist",
      description: "Read a single SOP checklist and its tasks.",
      inputSchema: z.object({
        checklistId: z.string(),
      }),
    },
    async ({ checklistId }, ctx) => {
      const user = requireUser(ctx);
      if (!isUser(user)) return user;
      const checklist = await prisma.sOPChecklist.findUnique({
        where: { id: checklistId },
        include: {
          event: { select: { id: true, title: true } },
          tasks: {
            include: {
              assignee: { select: { id: true, name: true, email: true } },
              volunteerAssignee: { select: { id: true, name: true } },
            },
            orderBy: { sortOrder: "asc" },
          },
        },
      });
      if (!checklist) return mcpError("Checklist not found", 404);
      if (!(await canUserAccessEvent(user.id, checklist.eventId, "read"))) {
        return mcpError("Forbidden", 403);
      }
      return mcpJson(checklist);
    }
  );

  server.registerTool(
    "update_sop_task",
    {
      title: "Update SOP task",
      description:
        "Update an SOP task: status, title, priority, deadline, blocked reason, or assignees. Volunteers may only toggle their own status or self-assign.",
      inputSchema: z.object({
        checklistId: z.string(),
        taskId: z.string(),
        status: z.enum(TASK_STATUSES).optional(),
        title: z.string().optional(),
        priority: z.enum(PRIORITIES).optional(),
        deadline: z.string().nullable().optional().describe("ISO 8601 datetime, or null to clear"),
        assigneeId: z.string().nullable().optional(),
        volunteerAssigneeId: z.string().nullable().optional(),
        blockedReason: z.string().nullable().optional(),
      }),
    },
    async ({ checklistId, taskId, ...body }, ctx) => {
      const user = requireUser(ctx);
      if (!isUser(user)) return user;
      const result = await updateSopTask(user, checklistId, taskId, body);
      if (!result.ok) return mcpError(result.error, result.status);
      return mcpJson(result.task);
    }
  );

  server.registerTool(
    "assign_task",
    {
      title: "Assign SOP task",
      description:
        "Assign an SOP task to a team member (user id) or volunteer. Omit assigneeId to assign the task to yourself. Team leads can assign to others.",
      inputSchema: z.object({
        checklistId: z.string(),
        taskId: z.string(),
        assigneeId: z.string().optional().describe("User id of the assignee. Defaults to the logged-in user."),
        volunteerAssigneeId: z.string().optional().describe("Volunteer directory id, if assigning to a volunteer"),
      }),
    },
    async ({ checklistId, taskId, assigneeId, volunteerAssigneeId }, ctx) => {
      const user = requireUser(ctx);
      if (!isUser(user)) return user;

      let payload: { assigneeId?: string | null; volunteerAssigneeId?: string | null };
      if (volunteerAssigneeId) {
        payload = { volunteerAssigneeId, assigneeId: null };
      } else if (assigneeId) {
        payload = { assigneeId, volunteerAssigneeId: null };
      } else if (!hasMinimumRole(roleOf(user), "EVENT_LEAD")) {
        const volunteer = await prisma.volunteer.findFirst({
          where: { userId: user.id },
          select: { id: true },
        });
        payload = volunteer
          ? { volunteerAssigneeId: volunteer.id, assigneeId: null }
          : { assigneeId: user.id, volunteerAssigneeId: null };
      } else {
        payload = { assigneeId: user.id, volunteerAssigneeId: null };
      }

      const result = await updateSopTask(user, checklistId, taskId, payload);
      if (!result.ok) return mcpError(result.error, result.status);
      return mcpJson({ message: "Task assigned", task: result.task });
    }
  );

  server.registerTool(
    "create_sop_task",
    {
      title: "Create SOP task",
      description: "Add a task to an existing SOP checklist.",
      inputSchema: z.object({
        checklistId: z.string(),
        title: z.string(),
        priority: z.enum(PRIORITIES).optional(),
        deadline: z.string().optional(),
        assigneeId: z.string().optional(),
      }),
    },
    async ({ checklistId, title, priority, deadline, assigneeId }, ctx) => {
      const user = requireUser(ctx);
      if (!isUser(user)) return user;
      const checklist = await prisma.sOPChecklist.findUnique({
        where: { id: checklistId },
        select: { id: true, eventId: true },
      });
      if (!checklist) return mcpError("Checklist not found", 404);
      if (!(await canUserAccessEvent(user.id, checklist.eventId, "update"))) {
        return mcpError("Forbidden", 403);
      }
      const maxSortOrder = await prisma.sOPTask.aggregate({
        where: { checklistId },
        _max: { sortOrder: true },
      });
      const task = await prisma.sOPTask.create({
        data: {
          checklistId,
          title: title.trim(),
          priority: priority ?? "MEDIUM",
          sortOrder: (maxSortOrder._max.sortOrder ?? -1) + 1,
          deadline: deadline ? new Date(deadline) : null,
          ownerId: user.id,
          assigneeId: assigneeId ?? null,
        },
        include: {
          assignee: { select: { id: true, name: true, email: true } },
        },
      });
      if (assigneeId) {
        await sendTaskAssignedEmail(task.id, user.name ?? undefined);
      }
      return mcpJson(task);
    }
  );

  server.registerTool(
    "list_my_tasks",
    {
      title: "List my tasks",
      description: "List incomplete SOP tasks owned by or assigned to the logged-in user.",
      inputSchema: z.object({}),
    },
    async (_args, ctx) => {
      const user = requireUser(ctx);
      if (!isUser(user)) return user;
      const tasks = await prisma.sOPTask.findMany({
        where: {
          OR: [
            { ownerId: user.id },
            { assigneeId: user.id },
            { volunteerAssignee: { userId: user.id } },
          ],
          status: { not: "DONE" },
        },
        orderBy: { deadline: "asc" },
        take: 50,
        include: {
          assignee: { select: { id: true, name: true } },
          checklist: { select: { id: true, title: true, event: { select: { id: true, title: true } } } },
        },
      });
      return mcpJson(tasks);
    }
  );

  server.registerTool(
    "list_overdue_tasks",
    {
      title: "List overdue tasks",
      description:
        "List overdue SOP items for the logged-in user. Set mineOnly to false (Event Lead+) to see overdue tasks across accessible events.",
      inputSchema: z.object({
        mineOnly: z.boolean().optional().describe("Default true: only tasks assigned to the current user"),
      }),
    },
    async ({ mineOnly }, ctx) => {
      const user = requireUser(ctx);
      if (!isUser(user)) return user;
      const assignedEventIds = await getAssignedEventIds(user.id, roleOf(user));
      const restrictToMine = mineOnly !== false || !hasMinimumRole(roleOf(user), "EVENT_LEAD");
      const now = new Date();

      const tasks = await prisma.sOPTask.findMany({
        where: {
          deadline: { lt: now },
          status: { not: "DONE" },
          ...(assignedEventIds !== null ? { checklist: { eventId: { in: assignedEventIds } } } : {}),
          ...(restrictToMine
            ? {
                OR: [
                  { ownerId: user.id },
                  { assigneeId: user.id },
                  { volunteerAssignee: { userId: user.id } },
                ],
              }
            : {}),
        },
        orderBy: { deadline: "asc" },
        take: 50,
        include: {
          assignee: { select: { id: true, name: true, email: true } },
          volunteerAssignee: { select: { id: true, name: true } },
          checklist: { select: { id: true, title: true, event: { select: { id: true, title: true } } } },
        },
      });
      return mcpJson({ count: tasks.length, tasks });
    }
  );

  server.registerTool(
    "list_members",
    {
      title: "List team members",
      description: "List team members (for assigning SOP tasks). Requires EVENT_LEAD or higher.",
      inputSchema: z.object({}),
    },
    async (_args, ctx) => {
      const user = requireUser(ctx);
      if (!isUser(user)) return user;
      if (!hasMinimumRole(roleOf(user), "EVENT_LEAD")) {
        return mcpError("Forbidden: Event Lead role required", 403);
      }
      const members = await prisma.user.findMany({
        where: { globalRole: { notIn: ["SUPER_ADMIN", "VOLUNTEER", "VIEWER"] } },
        select: { id: true, name: true, email: true, globalRole: true },
        orderBy: { name: "asc" },
      });
      return mcpJson(members);
    }
  );

  server.registerTool(
    "list_speakers",
    {
      title: "List speakers",
      description: "List speaker directory entries.",
      inputSchema: z.object({}),
    },
    async (_args, ctx) => {
      const user = requireUser(ctx);
      if (!isUser(user)) return user;
      const assignedEventIds = await getAssignedEventIds(user.id, roleOf(user));
      const speakers = await prisma.speaker.findMany({
        where:
          assignedEventIds !== null
            ? { events: { some: { eventId: { in: assignedEventIds } } } }
            : {},
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          topic: true,
          bio: true,
        },
        orderBy: { name: "asc" },
        take: 100,
      });
      return mcpJson(speakers);
    }
  );

  server.registerTool(
    "get_speaker",
    {
      title: "Get speaker",
      description: "Get speaker details and linked events.",
      inputSchema: z.object({ speakerId: z.string() }),
    },
    async ({ speakerId }, ctx) => {
      const user = requireUser(ctx);
      if (!isUser(user)) return user;
      const speaker = await prisma.speaker.findUnique({
        where: { id: speakerId },
        include: {
          events: {
            include: { event: { select: { id: true, title: true, date: true, status: true } } },
          },
        },
      });
      if (!speaker) return mcpError("Speaker not found", 404);
      return mcpJson(speaker);
    }
  );

  server.registerTool(
    "list_venues",
    {
      title: "List venue partners",
      description: "List venue partners.",
      inputSchema: z.object({}),
    },
    async (_args, ctx) => {
      const user = requireUser(ctx);
      if (!isUser(user)) return user;
      const assignedEventIds = await getAssignedEventIds(user.id, roleOf(user));
      const venues = await prisma.venuePartner.findMany({
        where:
          assignedEventIds !== null
            ? { events: { some: { eventId: { in: assignedEventIds } } } }
            : {},
        select: {
          id: true,
          name: true,
          contactName: true,
          email: true,
          phone: true,
          address: true,
          capacity: true,
          website: true,
          notes: true,
        },
        orderBy: { name: "asc" },
        take: 100,
      });
      return mcpJson(venues);
    }
  );

  server.registerTool(
    "get_venue",
    {
      title: "Get venue partner",
      description: "Get venue partner details and linked events.",
      inputSchema: z.object({ venueId: z.string() }),
    },
    async ({ venueId }, ctx) => {
      const user = requireUser(ctx);
      if (!isUser(user)) return user;
      const venue = await prisma.venuePartner.findUnique({
        where: { id: venueId },
        include: {
          events: {
            include: { event: { select: { id: true, title: true, date: true, status: true } } },
          },
        },
      });
      if (!venue) return mcpError("Venue not found", 404);
      return mcpJson(venue);
    }
  );

  server.registerTool(
    "list_volunteers",
    {
      title: "List volunteers",
      description: "List volunteer directory entries. Requires EVENT_LEAD or higher.",
      inputSchema: z.object({}),
    },
    async (_args, ctx) => {
      const user = requireUser(ctx);
      if (!isUser(user)) return user;
      if (!hasMinimumRole(roleOf(user), "EVENT_LEAD")) {
        return mcpError("Forbidden: Event Lead role required", 403);
      }
      const volunteers = await prisma.volunteer.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          userId: true,
        },
        orderBy: { name: "asc" },
        take: 100,
      });
      return mcpJson(volunteers);
    }
  );

  server.registerTool(
    "send_venue_request_email",
    {
      title: "Send venue request email",
      description:
        "Send a venue booking request email for an event venue link. Event creator or Admin only. Use get_event to find venuePartners[].id as linkId.",
      inputSchema: z.object({
        eventId: z.string(),
        linkId: z.string().describe("EventVenuePartner link id from get_event"),
        subject: z.string(),
        message: z.string(),
        cc: z.string().optional().describe("Comma-separated CC emails"),
      }),
    },
    async ({ eventId, linkId, subject, message, cc }, ctx) => {
      const user = requireUser(ctx);
      if (!isUser(user)) return user;
      const result = await sendVenueRequestEmail(user, eventId, linkId, { subject, message, cc });
      if (!result.ok) return mcpError(result.error, result.status);
      return mcpJson({ success: true, ...result });
    }
  );

  server.registerTool(
    "send_speaker_invitation",
    {
      title: "Send speaker invitation",
      description:
        "Trigger the speaker invitation email for an event-speaker link. Use get_event speakers[].id as eventSpeakerId.",
      inputSchema: z.object({
        eventSpeakerId: z.string(),
      }),
    },
    async ({ eventSpeakerId }, ctx) => {
      const user = requireUser(ctx);
      if (!isUser(user)) return user;
      if (!isEmailConfigured()) {
        return mcpError("SMTP is not configured", 400);
      }
      const link = await prisma.eventSpeaker.findUnique({
        where: { id: eventSpeakerId },
        select: { id: true, eventId: true, speaker: { select: { email: true, name: true } } },
      });
      if (!link) return mcpError("Event speaker link not found", 404);
      if (!(await canUserAccessEvent(user.id, link.eventId, "update"))) {
        return mcpError("Forbidden", 403);
      }
      if (!link.speaker.email) {
        return mcpError("Speaker has no email address", 400);
      }
      await sendSpeakerInvitationEmail(eventSpeakerId);
      return mcpJson({ success: true, sentTo: link.speaker.email, speaker: link.speaker.name });
    }
  );

  server.registerTool(
    "send_event_created_email",
    {
      title: "Send event created email",
      description: "Re-send the event-created notification to the event team.",
      inputSchema: z.object({
        eventId: z.string(),
      }),
    },
    async ({ eventId }, ctx) => {
      const user = requireUser(ctx);
      if (!isUser(user)) return user;
      if (!isEmailConfigured()) {
        return mcpError("SMTP is not configured", 400);
      }
      if (!(await canUserAccessEvent(user.id, eventId, "update"))) {
        return mcpError("Forbidden", 403);
      }
      await sendEventCreatedEmail(eventId);
      return mcpJson({ success: true, eventId });
    }
  );

  server.registerTool(
    "send_task_assigned_email",
    {
      title: "Send task assigned email",
      description: "Re-send the task-assigned notification for a task.",
      inputSchema: z.object({
        taskId: z.string(),
      }),
    },
    async ({ taskId }, ctx) => {
      const user = requireUser(ctx);
      if (!isUser(user)) return user;
      if (!isEmailConfigured()) {
        return mcpError("SMTP is not configured", 400);
      }
      const task = await prisma.sOPTask.findUnique({
        where: { id: taskId },
        select: { id: true, checklist: { select: { eventId: true } } },
      });
      if (!task) return mcpError("Task not found", 404);
      if (!(await canUserAccessEvent(user.id, task.checklist.eventId, "update"))) {
        return mcpError("Forbidden", 403);
      }
      await sendTaskAssignedEmail(taskId, user.name ?? undefined);
      return mcpJson({ success: true, taskId });
    }
  );
}
