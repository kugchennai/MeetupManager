import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth-helpers";
import { hasMinimumRole } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import type { GlobalRole } from "@/generated/prisma/enums";

// Public settings anyone authenticated can read
const PUBLIC_KEYS = ["volunteer_promotion_threshold", "meetup_name", "meetup_description", "meetup_website", "meetup_past_event_link", "min_volunteer_tasks", "min_event_duration", "logo_light", "logo_dark"];

// Max size for base64 logo values (~200KB encoded)
const MAX_LOGO_SIZE = 300_000;

export async function GET(req: Request) {
  const session = await getAuthSession(req);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await prisma.appSetting.findMany({
    where: { key: { in: PUBLIC_KEYS } },
  });

  const result: Record<string, string> = {};
  for (const s of settings) {
    result[s.key] = s.value;
  }

  return NextResponse.json(result);
}

export async function PATCH(req: NextRequest) {
  const session = await getAuthSession(req);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasMinimumRole(session.user.globalRole as GlobalRole, "SUPER_ADMIN")) {
    return NextResponse.json(
      { error: "Forbidden: Super Admin role required" },
      { status: 403 }
    );
  }

  const body = await req.json();
  const { key, value } = body;

  if (!key || typeof key !== "string" || typeof value !== "string") {
    return NextResponse.json({ error: "key and value are required strings" }, { status: 400 });
  }

  if (!PUBLIC_KEYS.includes(key)) {
    return NextResponse.json({ error: "Unknown setting key" }, { status: 400 });
  }

  // Validate logo size
  if ((key === "logo_light" || key === "logo_dark") && value.length > MAX_LOGO_SIZE) {
    return NextResponse.json(
      { error: "Logo image is too large. Please use an image under 200KB." },
      { status: 400 }
    );
  }

  const setting = await prisma.appSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });

  await logAudit({
    userId: session.user.id,
    action: "UPDATE",
    entityType: "AppSetting",
    entityId: key,
    entityName: key,
    changes: key.startsWith("logo_") ? { value: "(logo image updated)" } : { value },
  });

  return NextResponse.json(setting);
}
