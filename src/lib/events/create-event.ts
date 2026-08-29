import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { sendEventCreatedEmail } from "@/lib/emails/triggers";

export type CreateEventInput = {
  title: string;
  description?: string | null;
  date: string;
  endDate: string;
  venue?: string | null;
  pageLink?: string | null;
  templateId: string;
};

export type CreateEventResult =
  | { ok: true; event: { id: string; title: string; date: Date; endDate: Date; venue: string | null } }
  | { ok: false; status: number; error: string };

export async function createEvent(
  userId: string,
  input: CreateEventInput
): Promise<CreateEventResult> {
  const { title, description, date, endDate, venue, pageLink, templateId } = input;

  if (!title || !date || !endDate) {
    return { ok: false, status: 400, error: "Title, start date, and end date are required" };
  }

  const startDate = new Date(date);
  const endDateParsed = new Date(endDate);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDateParsed.getTime())) {
    return { ok: false, status: 400, error: "Invalid start or end date" };
  }
  if (endDateParsed <= startDate) {
    return { ok: false, status: 400, error: "End time must be greater than start time" };
  }

  const minDurationSetting = await prisma.appSetting.findUnique({
    where: { key: "min_event_duration" },
  });
  const minEventDuration = minDurationSetting ? parseInt(minDurationSetting.value, 10) : 4;
  const eventDurationHours = (endDateParsed.getTime() - startDate.getTime()) / (1000 * 60 * 60);

  if (eventDurationHours < minEventDuration) {
    return {
      ok: false,
      status: 400,
      error: `Event duration must be at least ${minEventDuration} hours. Current duration: ${eventDurationHours.toFixed(1)} hours.`,
    };
  }

  if (!templateId) {
    return {
      ok: false,
      status: 400,
      error: "SOP template is required. Please create one in Settings > Templates first.",
    };
  }

  const event = await prisma.event.create({
    data: {
      title,
      description: description ?? undefined,
      date: startDate,
      endDate: endDateParsed,
      venue: venue ?? undefined,
      pageLink: pageLink || null,
      createdById: userId,
      members: {
        create: {
          userId,
          eventRole: "LEAD",
        },
      },
    },
    include: {
      createdBy: { select: { id: true, name: true, image: true } },
    },
  });

  const template = await prisma.sOPTemplate.findUnique({
    where: { id: templateId },
  });

  if (template && Array.isArray(template.defaultTasks)) {
    const tasks = template.defaultTasks as Array<{
      title: string;
      relativeDays?: number;
      priority?: string;
      section?: string;
      subcategory?: string;
    }>;

    const eventDate = startDate;

    const sectionLabels: Record<string, string> = {
      PRE_EVENT: "Pre-Event",
      ON_DAY: "On-Day",
      POST_EVENT: "Post-Event",
    };
    const sectionOrder = ["PRE_EVENT", "ON_DAY", "POST_EVENT"];

    type GroupKey = string;
    const grouped: Map<GroupKey, { section: string; subcategory: string; tasks: typeof tasks }> = new Map();
    const groupOrder: GroupKey[] = [];

    for (const task of tasks) {
      const sec = task.section && sectionOrder.includes(task.section)
        ? task.section
        : (task.relativeDays ?? 0) > 0 ? "PRE_EVENT" : (task.relativeDays ?? 0) === 0 ? "ON_DAY" : "POST_EVENT";
      const sub = task.subcategory?.trim() || sectionLabels[sec];
      const key = `${sec}::${sub}`;

      if (!grouped.has(key)) {
        grouped.set(key, { section: sec, subcategory: sub, tasks: [] });
        groupOrder.push(key);
      }
      grouped.get(key)!.tasks.push(task);
    }

    groupOrder.sort((a, b) => {
      const secA = sectionOrder.indexOf(a.split("::")[0]);
      const secB = sectionOrder.indexOf(b.split("::")[0]);
      return secA - secB;
    });

    let sortIdx = 0;
    for (const key of groupOrder) {
      const group = grouped.get(key)!;
      const sectionTasks = group.tasks;
      if (sectionTasks.length === 0) continue;

      const checklistTitle = `${sectionLabels[group.section]}: ${group.subcategory}`;

      await prisma.sOPChecklist.create({
        data: {
          eventId: event.id,
          title: checklistTitle,
          sortOrder: sortIdx++,
          tasks: {
            create: sectionTasks.map((task, index) => ({
              title: task.title,
              priority: (task.priority as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL") ?? "MEDIUM",
              sortOrder: index,
              deadline: task.relativeDays != null
                ? new Date(eventDate.getTime() - task.relativeDays * 24 * 60 * 60 * 1000)
                : undefined,
            })),
          },
        },
      });
    }
  }

  await logAudit({
    userId,
    action: "CREATE",
    entityType: "Event",
    entityId: event.id,
    entityName: title,
    changes: { title, date, endDate, venue },
  });

  await sendEventCreatedEmail(event.id);

  return { ok: true, event };
}
