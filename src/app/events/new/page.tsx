"use client";

import { PageHeader, Button, DateTimePicker } from "@/components/design-system";
import { ArrowLeft, MapPin, FileText, ClipboardCheck, Link2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useAppSettings } from "@/lib/app-settings-context";

interface SOPTemplate {
  id: string;
  name: string;
  description: string | null;
}

const ROLE_LEVEL: Record<string, number> = { VIEWER: 0, VOLUNTEER: 1, EVENT_LEAD: 2, ADMIN: 3, SUPER_ADMIN: 4 };

export default function CreateEventPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const userRole = session?.user?.globalRole ?? "";
  const hasAccess = (ROLE_LEVEL[userRole] ?? 0) >= ROLE_LEVEL.EVENT_LEAD;

  const { globalTimezone } = useAppSettings();

  useEffect(() => {
    if (status === "loading") return;
    if (!hasAccess) router.replace("/dashboard");
  }, [status, hasAccess, router]);

  const [submitting, setSubmitting] = useState(false);
  const [templates, setTemplates] = useState<SOPTemplate[]>([]);
  const [dateValidationError, setDateValidationError] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    date: "",
    endDate: "",
    venue: "",
    pageLink: "",
    templateId: "",
  });

  useEffect(() => {
    fetch("/api/templates")
      .then((r) => (r.ok ? r.json() : []))
      .then(setTemplates)
      .catch(() => { });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate that end date is after start date
    if (form.date && form.endDate) {
      const startDate = new Date(form.date);
      const endDate = new Date(form.endDate);
      if (endDate <= startDate) {
        setDateValidationError("End time must be greater than start time");
        return;
      }
    }

    setDateValidationError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (res.ok) {
        const event = await res.json();
        router.push(`/events/${event.id}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="animate-fade-in max-w-2xl">
      <div className="mb-6">
        <Link
          href="/events"
          className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to Events
        </Link>
        <PageHeader title="Create Event" description="Set up a new meetup" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-surface border border-border rounded-xl p-6 space-y-5">
          {/* Title */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-muted mb-1.5">
              Event Title *
            </label>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="React Bangalore Meetup #13"
              className="w-full bg-background border border-border rounded-lg px-3.5 py-2.5 text-sm placeholder:text-muted/50 focus:border-accent focus:ring-1 focus:ring-accent/30 outline-none transition-all"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-muted mb-1.5">
              Description
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="What's this meetup about?"
              rows={3}
              className="w-full bg-background border border-border rounded-lg px-3.5 py-2.5 text-sm placeholder:text-muted/50 focus:border-accent focus:ring-1 focus:ring-accent/30 outline-none transition-all resize-none"
            />
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted mb-1.5">
                Start Date & Time *
              </label>
              <DateTimePicker
                required
                timeZone={globalTimezone}
                value={form.date}
                onChange={(date) => {
                  setForm({ ...form, date });
                  // Clear validation error when user changes the date
                  if (dateValidationError) {
                    setDateValidationError(null);
                  }
                }}
              />
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted mb-1.5">
                End Date & Time *
              </label>
              <DateTimePicker
                required
                timeZone={globalTimezone}
                value={form.endDate}
                minDateTime={form.date} // Constrain end time to be after start time
                onChange={(endDate) => {
                  setForm({ ...form, endDate });
                  // Clear validation error when user changes the date
                  if (dateValidationError) {
                    setDateValidationError(null);
                  }
                }}
              />
              {dateValidationError && (
                <p className="text-sm text-red-400 mt-1.5">
                  {dateValidationError}
                </p>
              )}
            </div>
          </div>

          {/* Venue */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted mb-1.5">
              <MapPin className="h-3 w-3" /> Venue
            </label>
            <input
              type="text"
              value={form.venue}
              onChange={(e) => setForm({ ...form, venue: e.target.value })}
              placeholder="WeWork, Koramangala"
              className="w-full bg-background border border-border rounded-lg px-3.5 py-2.5 text-sm placeholder:text-muted/50 focus:border-accent focus:ring-1 focus:ring-accent/30 outline-none transition-all"
            />
          </div>

          {/* Event Page Link */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted mb-1.5">
              <Link2 className="h-3 w-3" /> Event Page Link
            </label>
            <input
              type="url"
              value={form.pageLink}
              onChange={(e) => setForm({ ...form, pageLink: e.target.value })}
              placeholder="https://lu.ma/your-event"
              className="w-full bg-background border border-border rounded-lg px-3.5 py-2.5 text-sm placeholder:text-muted/50 focus:border-accent focus:ring-1 focus:ring-accent/30 outline-none transition-all"
            />
            <p className="mt-1 text-[11px] text-muted">
              Optional — add a link to lu.ma, meetup.com, or your event page
            </p>
          </div>

          {/* SOP Template */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted mb-1.5">
              <ClipboardCheck className="h-3 w-3" /> SOP Template *
            </label>
            {templates.length > 0 ? (
              <>
                <select
                  required
                  value={form.templateId}
                  onChange={(e) => setForm({ ...form, templateId: e.target.value })}
                  className={cn(
                    "w-full bg-background border rounded-lg px-3.5 py-2.5 text-sm focus:border-accent outline-none transition-all cursor-pointer",
                    !form.templateId ? "border-border" : "border-border"
                  )}
                >
                  <option value="" disabled>Select a template</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-muted">
                  Pre-fill the SOP checklist from a template
                </p>
              </>
            ) : (
              <div className="rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3">
                <p className="text-sm text-red-400">
                  No SOP templates found. You must create an SOP template before creating an event.
                </p>
                <Link
                  href="/settings/templates"
                  className="inline-flex items-center gap-1.5 mt-2 text-xs font-medium text-accent hover:underline"
                >
                  <FileText className="h-3 w-3" />
                  Create an SOP Template
                </Link>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={submitting || templates.length === 0}>
            {submitting ? "Creating..." : "Create Event"}
          </Button>
          <Link href="/events">
            <Button variant="ghost" type="button">Cancel</Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
