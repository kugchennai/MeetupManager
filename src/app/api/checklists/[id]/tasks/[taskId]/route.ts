import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth-helpers";
import { canUserAccessEvent } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { updateSopTask } from "@/lib/tasks/update-task";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  const { id: checklistId, taskId } = await params;
  const session = await getAuthSession(req);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const result = await updateSopTask(session.user, checklistId, taskId, body);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result.task);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  const { id: checklistId, taskId } = await params;
  const session = await getAuthSession(req);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const checklist = await prisma.sOPChecklist.findUnique({
    where: { id: checklistId },
    select: { id: true, eventId: true },
  });

  if (!checklist) {
    return NextResponse.json({ error: "Checklist not found" }, { status: 404 });
  }

  const canEdit = await canUserAccessEvent(session.user.id, checklist.eventId, "update");
  if (!canEdit) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const task = await prisma.sOPTask.findFirst({
    where: { id: taskId, checklistId },
    select: { id: true, title: true },
  });

  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  await prisma.sOPTask.delete({ where: { id: taskId } });

  await logAudit({
    userId: session.user.id,
    action: "DELETE",
    entityType: "SOPTask",
    entityId: taskId,
    entityName: task.title,
    changes: { title: task.title },
  });

  return NextResponse.json({ success: true });
}
