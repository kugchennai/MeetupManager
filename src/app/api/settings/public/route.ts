import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Public endpoint - no auth required
// Returns meetup name and logo for public pages
export async function GET() {
  const settings = await prisma.appSetting.findMany({
    where: { key: { in: ["meetup_name", "meetup_description", "meetup_website", "meetup_past_event_link", "logo_light", "logo_dark"] } },
  });

  const result: Record<string, string> = {};
  for (const s of settings) {
    result[s.key] = s.value;
  }

  return NextResponse.json({
    meetupName: result.meetup_name ?? "Event Manager",
    meetupDescription: result.meetup_description ?? "",
    meetupWebsite: result.meetup_website ?? "",
    meetupPastEventLink: result.meetup_past_event_link ?? "",
    logoLight: result.logo_light ?? null,
    logoDark: result.logo_dark ?? null,
  });
}
