import { prisma } from "./prisma";
import type { GlobalRole, EventRole } from "@/generated/prisma/enums";

type Action = "create" | "read" | "update" | "delete" | "manage";

const ROLE_HIERARCHY: Record<string, number> = {
  VIEWER: 0,
  VOLUNTEER: 1,
  EVENT_LEAD: 2,
  ADMIN: 3,
  SUPER_ADMIN: 4,
};

const EVENT_ROLE_HIERARCHY: Record<string, number> = {
  VIEWER: 0,
  VOLUNTEER: 1,
  ORGANIZER: 2,
  LEAD: 3,
};

export function hasMinimumRole(userRole: GlobalRole, requiredRole: GlobalRole): boolean {
  return (ROLE_HIERARCHY[userRole] ?? 0) >= (ROLE_HIERARCHY[requiredRole] ?? 0);
}

export function hasMinimumEventRole(userRole: EventRole, requiredRole: EventRole): boolean {
  return (EVENT_ROLE_HIERARCHY[userRole] ?? 0) >= (EVENT_ROLE_HIERARCHY[requiredRole] ?? 0);
}

/**
 * Volunteer-scoped event IDs, or `null` when the user can see all events.
 */
export async function getAssignedEventIds(
  userId: string,
  userRole: GlobalRole
): Promise<string[] | null> {
  if (userRole !== "VOLUNTEER") return null;

  const [volunteerLinks, memberLinks] = await Promise.all([
    prisma.eventVolunteer.findMany({
      where: { volunteer: { userId } },
      select: { eventId: true },
    }),
    prisma.eventMember.findMany({
      where: { userId },
      select: { eventId: true },
    }),
  ]);

  return [
    ...new Set([
      ...volunteerLinks.map((v) => v.eventId),
      ...memberLinks.map((m) => m.eventId),
    ]),
  ];
}

export async function canUserAccessEvent(
  userId: string,
  eventId: string,
  action: Action
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { globalRole: true },
  });

  if (!user) return false;
  if (user.globalRole === "SUPER_ADMIN" || user.globalRole === "ADMIN") return true;

  // VIEWER (Temporary Viewer) can only read
  if (user.globalRole === "VIEWER") return action === "read";

  const membership = await prisma.eventMember.findUnique({
    where: { eventId_userId: { eventId, userId } },
    select: { eventRole: true },
  });

  // For VOLUNTEER global role: also check if they're linked as a volunteer to this event
  if (!membership && user.globalRole === "VOLUNTEER") {
    const volunteerLink = await prisma.eventVolunteer.findFirst({
      where: { eventId, volunteer: { userId } },
    });
    return volunteerLink ? action === "read" : false;
  }

  if (!membership) {
    return action === "read" && hasMinimumRole(user.globalRole, "EVENT_LEAD");
  }

  switch (action) {
    case "read":
      return true;
    case "create":
    case "update":
      return hasMinimumEventRole(membership.eventRole, "ORGANIZER");
    case "delete":
    case "manage":
      return hasMinimumEventRole(membership.eventRole, "LEAD");
    default:
      return false;
  }
}

export async function getUserEventRole(
  userId: string,
  eventId: string
): Promise<EventRole | null> {
  const membership = await prisma.eventMember.findUnique({
    where: { eventId_userId: { eventId, userId } },
    select: { eventRole: true },
  });
  return membership?.eventRole ?? null;
}
