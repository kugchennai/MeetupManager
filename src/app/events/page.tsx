"use client";

import { PageHeader, Button, EmptyState, AvatarStack } from "@/components/design-system";
import { Calendar, Plus, MapPin } from "lucide-react";
import Link from "next/link";
import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import { formatDate, formatRelativeDate, formatDateTimeRange, cn } from "@/lib/utils";
import { useAppSettings } from "@/lib/app-settings-context";

interface Event {
  id: string;
  title: string;
  description: string | null;
  date: string;
  endDate: string;
  venue: string | null;
  status: string;
  createdBy: { id: string; name: string | null; image: string | null };
  members: { user: { id: string; name: string | null; image: string | null } }[];
  _count: { speakers: number; volunteers: number; checklists: number };
}

type Filter = "today" | "upcoming" | "past" | "all";

function isUpcoming(dateStr: string) {
  const eventDate = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return eventDate >= today;
}

function isToday(dateStr: string) {
  const eventDate = new Date(dateStr);
  const today = new Date();
  return (
    eventDate.getFullYear() === today.getFullYear() &&
    eventDate.getMonth() === today.getMonth() &&
    eventDate.getDate() === today.getDate()
  );
}

function EventCard({ event, timeZone }: { event: Event; timeZone: string }) {
  const upcoming = isUpcoming(event.date);
  const today = isToday(event.date);

  return (
    <Link href={`/events/${event.id}`}>
      <div
        className={cn(
          "rounded-xl border bg-surface p-5 card-glow hover:-translate-y-[1px] hover:border-border-hover transition-all duration-150 h-full",
          today
            ? "border-accent/40 shadow-[0_0_20px_-4px_hsl(var(--accent)/0.25)] ring-1 ring-accent/20"
            : upcoming
              ? "border-border"
              : "border-border/60 opacity-75 hover:opacity-100"
        )}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            {today ? (
              <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium bg-accent/15 text-accent border-accent/25 animate-[pulse-glow_2s_ease-in-out_infinite]">
                <Calendar className="h-3 w-3" />
                Today
              </span>
            ) : upcoming ? (
              <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium bg-status-progress/15 text-status-progress border-status-progress/20">
                <Calendar className="h-3 w-3" />
                Upcoming
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium bg-surface-hover text-muted border-border">
                Ended
              </span>
            )}
          </div>
          <AvatarStack
            users={event.members.map((m) => m.user)}
            max={3}
            size="sm"
          />
        </div>

        <h3 className="text-base font-semibold font-[family-name:var(--font-display)] tracking-tight mb-1 line-clamp-2">
          {event.title}
        </h3>

        {event.description && (
          <p className="text-xs text-muted line-clamp-2 mb-3">{event.description}</p>
        )}

        <div className="flex items-center gap-3 text-xs text-muted mt-auto pt-2 border-t border-border">
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {formatDateTimeRange(event.date, event.endDate, timeZone)} <span className="hidden sm:inline">({formatRelativeDate(event.date)})</span>
          </span>
          {event.venue && (
            <span className="flex items-center gap-1 truncate">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{event.venue}</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 mt-2 text-[11px] font-[family-name:var(--font-mono)] text-muted">
          <span>{event._count.speakers} speakers</span>
          <span>{event._count.volunteers} volunteers</span>
        </div>
      </div>
    </Link>
  );
}

const ROLE_LEVEL: Record<string, number> = { VIEWER: 0, VOLUNTEER: 1, EVENT_LEAD: 2, ADMIN: 3, SUPER_ADMIN: 4 };

export default function EventsPage() {
  const { data: session } = useSession();
  const userRole = session?.user?.globalRole ?? "VIEWER";
  const canCreate = (ROLE_LEVEL[userRole] ?? 0) >= ROLE_LEVEL.EVENT_LEAD;

  const { globalTimezone } = useAppSettings();

  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter | null>(null);

  useEffect(() => {
    fetch("/api/events")
      .then((r) => (r.ok ? r.json() : []))
      .then(setEvents)
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, []);

  const { today: todayEvents, upcoming, past } = useMemo(() => {
    const td: Event[] = [];
    const up: Event[] = [];
    const pa: Event[] = [];
    for (const e of events) {
      if (isToday(e.date)) td.push(e);
      else if (isUpcoming(e.date)) up.push(e);
      else pa.push(e);
    }
    td.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    up.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    pa.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return { today: td, upcoming: up, past: pa };
  }, [events]);

  const hasTodayEvents = todayEvents.length > 0;

  // Auto-select the default filter once events load
  const activeFilter = filter ?? (hasTodayEvents ? "today" : "upcoming");

  const filtered =
    activeFilter === "today" ? todayEvents :
      activeFilter === "upcoming" ? upcoming :
        activeFilter === "past" ? past : events;

  const FILTERS: { id: Filter; label: string; count: number }[] = [
    ...(hasTodayEvents ? [{ id: "today" as Filter, label: "Today", count: todayEvents.length }] : []),
    { id: "upcoming", label: "Upcoming", count: upcoming.length },
    { id: "past", label: "Past", count: past.length },
    { id: "all", label: "All", count: events.length },
  ];

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Events"
        description="Manage your meetups and events"
        actions={
          canCreate ? (
            <Link href="/events/new">
              <Button>
                <Plus className="h-4 w-4" />
                New Event
              </Button>
            </Link>
          ) : undefined
        }
      />

      {!loading && events.length > 0 && (
        <div className="flex items-center gap-1 mb-6">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                "px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer",
                activeFilter === f.id
                  ? "bg-accent/15 text-accent"
                  : "text-muted hover:text-foreground hover:bg-surface-hover"
              )}
            >
              {f.label}
              <span className="ml-1.5 text-[10px] font-[family-name:var(--font-mono)] opacity-60">
                {f.count}
              </span>
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-surface p-5 space-y-3">
              <div className="h-4 w-24 rounded animate-shimmer" />
              <div className="h-6 w-48 rounded animate-shimmer" />
              <div className="h-3 w-full rounded animate-shimmer" />
            </div>
          ))}
        </div>
      ) : events.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="No events yet"
          description={canCreate ? "Create your first event to get started with managing your meetup." : "No events are available yet."}
          action={
            canCreate ? (
              <Link href="/events/new">
                <Button>
                  <Plus className="h-4 w-4" />
                  Create Event
                </Button>
              </Link>
            ) : undefined
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title={
            activeFilter === "today" ? "No events today" :
              activeFilter === "upcoming" ? "No upcoming events" :
                "No past events"
          }
          description={
            activeFilter === "today"
              ? "There are no events scheduled for today."
              : activeFilter === "upcoming"
                ? "All your events have already ended. Create a new one!"
                : "No events have ended yet."
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((event) => (
            <EventCard key={event.id} event={event} timeZone={globalTimezone} />
          ))}
        </div>
      )}
    </div>
  );
}
