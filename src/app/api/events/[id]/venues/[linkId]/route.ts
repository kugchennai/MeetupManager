import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth-helpers";
import { canUserAccessEvent, hasMinimumRole } from "@/lib/permissions";
import { logAudit, diffChanges } from "@/lib/audit";
import { sendVenueConfirmedEmail } from "@/lib/emails/triggers";
import type { VenuePartnerStatus, Priority, GlobalRole } from "@/generated/prisma/enums";

/**
 * Checks if a task title matches "venue confirmation" pattern.
 */
function isVenueConfirmationTask(title: string): boolean {
  const lower = title.toLowerCase();
  return lower.includes("venue") && lower.includes("confirm");
}

/**
 * Resets venue confirmation SOP tasks for an event to TODO.
 */
async function resetVenueConfirmationTasks(eventId: string, userId: string, reason: string) {
  const checklists = await prisma.sOPChecklist.findMany({
    where: { eventId },
    include: { tasks: true },
  });

  for (const checklist of checklists) {
    for (const task of checklist.tasks) {
      if (isVenueConfirmationTask(task.title) && task.status === "DONE") {
        await prisma.sOPTask.update({
          where: { id: task.id },
          data: { status: "TODO", completedAt: null },
        });

        await logAudit({
          userId,
          action: "UPDATE",
          entityType: "SOPTask",
          entityId: task.id,
          entityName: task.title,
          changes: {
            status: { from: "DONE", to: "TODO" },
            reason,
          },
        });
      }
    }
  }
}

/**
 * Marks venue confirmation SOP tasks for an event as DONE.
 */
async function completeVenueConfirmationTasks(eventId: string, userId: string, venueName: string) {
  const checklists = await prisma.sOPChecklist.findMany({
    where: { eventId },
    include: { tasks: true },
  });

  for (const checklist of checklists) {
    for (const task of checklist.tasks) {
      if (isVenueConfirmationTask(task.title) && task.status !== "DONE") {
        await prisma.sOPTask.update({
          where: { id: task.id },
          data: { status: "DONE", completedAt: new Date() },
        });

        await logAudit({
          userId,
          action: "UPDATE",
          entityType: "SOPTask",
          entityId: task.id,
          entityName: task.title,
          changes: {
            status: { from: task.status, to: "DONE" },
            reason: `Venue partner "${venueName}" confirmed`,
          },
        });
      }
    }
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; linkId: string }> }
) {
  const { id: eventId, linkId } = await params;
  const session = await getAuthSession(req);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const canEdit = await canUserAccessEvent(session.user.id, eventId, "update");
  if (!canEdit) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const before = await prisma.eventVenuePartner.findUnique({
    where: { id: linkId },
    include: { venuePartner: true },
  });

  if (!before || before.eventId !== eventId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const { status, priority, cost, notes, confirmationDate } = body;

  const userRole = session.user.globalRole as GlobalRole;
  const isConfirmTransition = status === "CONFIRMED" && before.status !== "CONFIRMED";
  if (isConfirmTransition && !hasMinimumRole(userRole, "ADMIN")) {
    return NextResponse.json(
      { error: "Forbidden: Only ADMIN and SUPER_ADMIN can confirm a venue and send venue email" },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(req.url);
  const force = searchParams.get("force") === "true";

  // If changing status to CONFIRMED, enforce single-confirmation constraint
  if (status === "CONFIRMED" && before.status !== "CONFIRMED") {
    const existingConfirmed = await prisma.eventVenuePartner.findFirst({
      where: {
        eventId,
        status: "CONFIRMED",
        id: { not: linkId },
      },
      include: { venuePartner: { select: { id: true, name: true } } },
    });

    if (existingConfirmed) {
      if (!force) {
        // Return 409 so frontend can show confirmation modal
        return NextResponse.json(
          {
            conflict: true,
            existingVenue: {
              id: existingConfirmed.id,
              venuePartner: { name: existingConfirmed.venuePartner.name },
            },
          },
          { status: 409 }
        );
      }

      // Force mode: reset existing confirmed venue to PENDING
      await prisma.eventVenuePartner.update({
        where: { id: existingConfirmed.id },
        data: { status: "PENDING", confirmationDate: null },
      });

      await logAudit({
        userId: session.user.id,
        action: "UPDATE",
        entityType: "EventVenuePartner",
        entityId: existingConfirmed.id,
        entityName: existingConfirmed.venuePartner.name,
        changes: {
          status: { from: "CONFIRMED", to: "PENDING" },
          reason: `Replaced by "${before.venuePartner.name}" as confirmed venue`,
        },
      });
    }
  }

  const updateData: Record<string, unknown> = {};

  if (status !== undefined) updateData.status = status as VenuePartnerStatus;
  if (priority !== undefined) updateData.priority = priority as Priority;
  if (cost !== undefined) updateData.cost = cost !== null && cost !== "" ? cost : null;
  if (notes !== undefined) updateData.notes = notes?.trim() || null;
  if (confirmationDate !== undefined) {
    updateData.confirmationDate = confirmationDate ? new Date(confirmationDate) : null;
  }

  // Auto-set confirmation date when confirming
  if (status === "CONFIRMED" && before.status !== "CONFIRMED" && confirmationDate === undefined) {
    updateData.confirmationDate = new Date();
  }

  // Clear confirmation date when moving away from confirmed
  if (status && status !== "CONFIRMED" && before.status === "CONFIRMED" && confirmationDate === undefined) {
    updateData.confirmationDate = null;
  }

  const updated = await prisma.eventVenuePartner.update({
    where: { id: linkId },
    data: updateData,
    include: {
      venuePartner: true,
      owner: { select: { id: true, name: true, image: true } },
    },
  });

  // Auto-sync event.venue field
  if (status === "CONFIRMED" && before.status !== "CONFIRMED") {
    // Set event venue to confirmed partner name
    await prisma.event.update({
      where: { id: eventId },
      data: { venue: updated.venuePartner.name },
    });

    // Auto-mark venue confirmation SOP tasks as DONE
    await completeVenueConfirmationTasks(
      eventId,
      session.user.id,
      updated.venuePartner.name
    );
  } else if (status && status !== "CONFIRMED" && before.status === "CONFIRMED") {
    // Clear event venue if it matches this partner
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (event && event.venue === before.venuePartner.name) {
      await prisma.event.update({
        where: { id: eventId },
        data: { venue: null },
      });
    }

    // Reset venue confirmation SOP tasks
    await resetVenueConfirmationTasks(
      eventId,
      session.user.id,
      `Venue partner "${before.venuePartner.name}" status changed to ${status}`
    );
  }

  const changes = diffChanges(
    {
      status: before.status,
      priority: before.priority,
      cost: before.cost?.toString() ?? null,
      notes: before.notes,
      confirmationDate: before.confirmationDate?.toISOString() ?? null,
    },
    {
      status: updated.status,
      priority: updated.priority,
      cost: updated.cost?.toString() ?? null,
      notes: updated.notes,
      confirmationDate: updated.confirmationDate?.toISOString() ?? null,
    }
  );

  if (Object.keys(changes).length > 0) {
    await logAudit({
      userId: session.user.id,
      action: "UPDATE",
      entityType: "EventVenuePartner",
      entityId: linkId,
      entityName: before.venuePartner.name,
      changes,
    });
  }

  // Send venue confirmed email to event lead
  if (status === "CONFIRMED" && before.status !== "CONFIRMED") {
    await sendVenueConfirmedEmail(linkId, eventId);
  }

  return NextResponse.json(updated);
}
