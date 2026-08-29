import { prisma } from "@/lib/prisma";
import { canUserAccessEvent } from "@/lib/permissions";
import { logAudit, diffChanges } from "@/lib/audit";
import { sendTaskAssignedEmail } from "@/lib/emails/triggers";

const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
const STATUSES = ["TODO", "IN_PROGRESS", "BLOCKED", "DONE"] as const;

export type UpdateSopTaskInput = {
  status?: (typeof STATUSES)[number];
  priority?: (typeof PRIORITIES)[number];
  deadline?: string | null;
  ownerId?: string | null;
  assigneeId?: string | null;
  volunteerAssigneeId?: string | null;
  blockedReason?: string | null;
  title?: string;
};

export type UpdateSopTaskResult =
  | { ok: true; task: Awaited<ReturnType<typeof prisma.sOPTask.update>> }
  | { ok: false; status: number; error: string };

export async function updateSopTask(
  user: { id: string; name?: string | null },
  checklistId: string,
  taskId: string,
  body: UpdateSopTaskInput
): Promise<UpdateSopTaskResult> {
  const checklist = await prisma.sOPChecklist.findUnique({
    where: { id: checklistId },
    select: { id: true, eventId: true },
  });

  if (!checklist) {
    return { ok: false, status: 404, error: "Checklist not found" };
  }

  const canEdit = await canUserAccessEvent(user.id, checklist.eventId, "update");

  let volunteerSelfOnly = false;
  let userVolunteerId: string | null = null;

  if (!canEdit) {
    const volunteerLink = await prisma.eventVolunteer.findFirst({
      where: { eventId: checklist.eventId, volunteer: { userId: user.id } },
      select: { volunteerId: true },
    });

    if (!volunteerLink) {
      return { ok: false, status: 403, error: "Forbidden" };
    }

    volunteerSelfOnly = true;
    userVolunteerId = volunteerLink.volunteerId;
  }

  const before = await prisma.sOPTask.findFirst({
    where: { id: taskId, checklistId },
  });

  if (!before) {
    return { ok: false, status: 404, error: "Task not found" };
  }

  const { status, priority, deadline, ownerId, assigneeId, volunteerAssigneeId, blockedReason, title } = body;

  const updateData: {
    status?: (typeof STATUSES)[number];
    priority?: (typeof PRIORITIES)[number];
    deadline?: Date | null;
    ownerId?: string | null;
    assigneeId?: string | null;
    volunteerAssigneeId?: string | null;
    blockedReason?: string | null;
    title?: string;
    completedAt?: Date | null;
  } = {};

  if (volunteerSelfOnly) {
    if (status !== undefined && STATUSES.includes(status)) {
      updateData.status = status;
      if (status === "DONE") updateData.completedAt = new Date();
      else if (before.status === "DONE") updateData.completedAt = null;
    }

    if (volunteerAssigneeId !== undefined) {
      if (volunteerAssigneeId === userVolunteerId) {
        updateData.volunteerAssigneeId = volunteerAssigneeId;
        updateData.assigneeId = null;
      } else if (!volunteerAssigneeId && before.volunteerAssigneeId === userVolunteerId) {
        updateData.volunteerAssigneeId = null;
      }
    }
  } else {
    if (status !== undefined && STATUSES.includes(status)) {
      updateData.status = status;
      if (status === "DONE") {
        updateData.completedAt = new Date();
      } else if (before.status === "DONE") {
        updateData.completedAt = null;
      }
    }

    if (priority !== undefined && PRIORITIES.includes(priority)) {
      updateData.priority = priority;
    }

    if (deadline !== undefined) {
      updateData.deadline = deadline ? new Date(deadline) : null;
    }

    if (ownerId !== undefined) {
      updateData.ownerId = ownerId || null;
    }

    if (assigneeId !== undefined) {
      updateData.assigneeId = assigneeId || null;
      if (assigneeId) updateData.volunteerAssigneeId = null;
    }

    if (volunteerAssigneeId !== undefined) {
      updateData.volunteerAssigneeId = volunteerAssigneeId || null;
      if (volunteerAssigneeId) updateData.assigneeId = null;
    }

    if (blockedReason !== undefined) {
      updateData.blockedReason = typeof blockedReason === "string" ? blockedReason.trim() || null : null;
    }

    if (title !== undefined && typeof title === "string" && title.trim()) {
      updateData.title = title.trim();
    }
  }

  const task = await prisma.sOPTask.update({
    where: { id: taskId },
    data: updateData,
    include: {
      owner: { select: { id: true, name: true, image: true } },
      assignee: { select: { id: true, name: true, image: true } },
      volunteerAssignee: { select: { id: true, name: true } },
    },
  });

  const beforeRecord = {
    status: before.status,
    priority: before.priority,
    deadline: before.deadline,
    ownerId: before.ownerId,
    assigneeId: before.assigneeId,
    volunteerAssigneeId: before.volunteerAssigneeId,
    blockedReason: before.blockedReason,
    title: before.title,
  };

  const afterRecord = {
    status: task.status,
    priority: task.priority,
    deadline: task.deadline,
    ownerId: task.ownerId,
    assigneeId: task.assigneeId,
    volunteerAssigneeId: task.volunteerAssigneeId,
    blockedReason: task.blockedReason,
    title: task.title,
  };

  const changes = diffChanges(beforeRecord, afterRecord);

  if (Object.keys(changes).length > 0) {
    await logAudit({
      userId: user.id,
      action: "UPDATE",
      entityType: "SOPTask",
      entityId: taskId,
      entityName: task.title,
      changes,
    });
  }

  const assigneeChanged = before.assigneeId !== task.assigneeId && task.assigneeId;
  const volunteerAssigneeChanged = before.volunteerAssigneeId !== task.volunteerAssigneeId && task.volunteerAssigneeId;
  if (assigneeChanged || volunteerAssigneeChanged) {
    await sendTaskAssignedEmail(taskId, user.name ?? undefined);
  }

  return { ok: true, task };
}
