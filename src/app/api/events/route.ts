import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth-helpers";
import { hasMinimumRole } from "@/lib/permissions";
import { createEvent } from "@/lib/events/create-event";
import type { GlobalRole } from "@/generated/prisma/enums";

export async function GET(req: Request) {
  const session = await getAuthSession(req);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userRole = session.user.globalRole as GlobalRole;
  const userId = session.user.id;

  const where = userRole === "VOLUNTEER"
    ? {
        OR: [
          { members: { some: { userId } } },
          { volunteers: { some: { volunteer: { userId } } } },
        ],
      }
    : undefined;

  const events = await prisma.event.findMany({
    where,
    include: {
      createdBy: { select: { id: true, name: true, image: true } },
      members: { include: { user: { select: { id: true, name: true, image: true } } } },
      _count: {
        select: { speakers: true, volunteers: true, checklists: true },
      },
    },
    orderBy: { date: "desc" },
  });

  return NextResponse.json(events);
}

export async function POST(req: NextRequest) {
  const session = await getAuthSession(req);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasMinimumRole(session.user.globalRole as GlobalRole, "EVENT_LEAD")) {
    return NextResponse.json({ error: "Forbidden: Event Lead role required" }, { status: 403 });
  }

  const body = await req.json();
  const result = await createEvent(session.user.id, body);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result.event, { status: 201 });
}
