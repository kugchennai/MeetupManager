import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL! });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const defaultTasks = [
          { title: "Venue confirmation", relativeDays: 30, priority: "CRITICAL", section: "PRE_EVENT" },
          { title: "Speaker outreach & confirmation", relativeDays: 28, priority: "CRITICAL", section: "PRE_EVENT" },
          { title: "Create event page / RSVP link", relativeDays: 21, priority: "HIGH", section: "PRE_EVENT" },
          { title: "Design event poster / social media graphics", relativeDays: 21, priority: "HIGH", section: "PRE_EVENT" },
          { title: "Post event on social media", relativeDays: 14, priority: "HIGH", section: "PRE_EVENT" },
          { title: "Confirm AV / projector setup", relativeDays: 14, priority: "MEDIUM", section: "PRE_EVENT" },
          { title: "Send reminder to speakers (slides, bio, etc.)", relativeDays: 7, priority: "HIGH", section: "PRE_EVENT" },
          { title: "Coordinate volunteer assignments", relativeDays: 7, priority: "MEDIUM", section: "PRE_EVENT" },
          { title: "Order food / refreshments", relativeDays: 5, priority: "MEDIUM", section: "PRE_EVENT" },
          { title: "Send attendee reminder email", relativeDays: 2, priority: "MEDIUM", section: "PRE_EVENT" },
          { title: "Print name badges / signage", relativeDays: 1, priority: "LOW", section: "PRE_EVENT" },
          { title: "Venue setup & tech check", relativeDays: 0, priority: "CRITICAL", section: "ON_DAY" },
          { title: "Registration desk & name badges", relativeDays: 0, priority: "HIGH", section: "ON_DAY" },
          { title: "Welcome & opening remarks", relativeDays: 0, priority: "HIGH", section: "ON_DAY" },
          { title: "Coordinate speaker transitions", relativeDays: 0, priority: "MEDIUM", section: "ON_DAY" },
          { title: "Photo & video capture", relativeDays: 0, priority: "MEDIUM", section: "ON_DAY" },
          { title: "Venue teardown & cleanup", relativeDays: 0, priority: "MEDIUM", section: "ON_DAY" },
          { title: "Send thank-you emails to speakers & sponsors", relativeDays: -1, priority: "HIGH", section: "POST_EVENT" },
          { title: "Share event photos & recordings", relativeDays: -3, priority: "MEDIUM", section: "POST_EVENT" },
          { title: "Collect attendee feedback (survey)", relativeDays: -2, priority: "HIGH", section: "POST_EVENT" },
          { title: "Write event recap / blog post", relativeDays: -5, priority: "LOW", section: "POST_EVENT" },
    { title: "Team retrospective", relativeDays: -7, priority: "MEDIUM", section: "POST_EVENT" },
  ];

  const existing = await prisma.sOPTemplate.findFirst({
    where: { name: "Default Meetup" },
  });

  if (!existing) {
    await prisma.sOPTemplate.create({
      data: {
        name: "Default Meetup",
        description: "Standard checklist for community meetups",
        defaultTasks,
      },
    });
    console.log("Seeded Default Meetup template");
  } else {
    await prisma.sOPTemplate.update({
      where: { id: existing.id },
      data: { defaultTasks },
    });
    console.log("Updated Default Meetup template with sections");
  }

  // Seed default app settings
  const defaultSettings = [
    { key: "meetup_name", value: "Meetup Manager" },
    { key: "meetup_description", value: "" },
    { key: "meetup_website", value: "" },
    { key: "meetup_past_event_link", value: "" },
    { key: "volunteer_promotion_threshold", value: "5" },
    { key: "min_volunteer_tasks", value: "7" },
    { key: "min_event_duration", value: "4" }
  ];

  for (const setting of defaultSettings) {
    const existingSetting = await prisma.appSetting.findUnique({
      where: { key: setting.key }
    });
    
    if (!existingSetting) {
      await prisma.appSetting.create({
        data: setting
      });
      console.log(`Seeded app setting: ${setting.key} = ${setting.value}`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
