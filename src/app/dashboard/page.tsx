"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { BentoGrid, BentoCard, StatCard, PageHeader, EmptyState, Button } from "@/components/design-system";
import { StatusBadge, PriorityBadge, OwnerAvatar } from "@/components/design-system";
import { CardSkeleton, TableRowSkeleton } from "@/components/design-system";
import { Calendar, Mic2, Users, ClipboardCheck, Plus, ArrowRight, AlertTriangle, Clock, Check } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

import { formatDate, formatDateTime, formatTimeAgo, formatRelativeDate } from "@/lib/utils";
import { useAppSettings } from "@/lib/app-settings-context";

const ROLE_LEVEL: Record<string, number> = { VIEWER: 0, VOLUNTEER: 1, EVENT_LEAD: 2, ADMIN: 3, SUPER_ADMIN: 4 };

type DashboardData = {
  nextEvent: {
    id: string;
    title: string;
    date: string;
    venue: string | null;
    status: string;
    progress: number;
    tasksCompleted: number;
    tasksTotal: number;
  } | null;
  myTasks: Array<{
    id: string;
    title: string;
    priority: string;
    status: string;
    deadline: string | null;
    owner: string | null;
    checklistId: string;
    eventId: string;
    eventTitle: string;
  }>;
  overdueTasks: Array<{
    id: string;
    title: string;
    deadline: string | null;
    owner: string | null;
  }>;
  stats: {
    totalEvents: number;
    upcomingEvents: number;
    pastEvents: number;
    todayEvents: number;
    totalSpeakers: number;
    totalVolunteers: number;
    tasksCompletedThisWeek: number;
  };
  recentActivity: Array<{
    id: string;
    action: string;
    entityType: string;
    entityId: string;
    createdAt: string;
    user: { id: string; name: string | null; email: string | null; image: string | null } | null;
  }>;
};

function activitySummary(entry: DashboardData["recentActivity"][0]): string {
  const userName = entry.user?.name ?? entry.user?.email ?? "Someone";
  const action = entry.action.toLowerCase();
  const entity = entry.entityType.toLowerCase();
  return `${userName} ${action}d ${entity}`;
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const userRole = session?.user?.globalRole ?? "VIEWER";
  const canCreate = (ROLE_LEVEL[userRole] ?? 0) >= ROLE_LEVEL.EVENT_LEAD;
  const isVolunteer = userRole === "VOLUNTEER";

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);

  const { globalTimezone } = useAppSettings();

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard");
      if (!res.ok) {
        if (res.status === 401) {
          setError("Please sign in to view the dashboard.");
          return;
        }
        throw new Error("Failed to load dashboard");
      }
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const toggleTaskDone = async (task: DashboardData["myTasks"][number]) => {
    setCompletingTaskId(task.id);
    const newStatus = task.status === "DONE" ? "TODO" : "DONE";
    await fetch(`/api/checklists/${task.checklistId}/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    setCompletingTaskId(null);
    fetchDashboard();
  };

  if (loading) {
    return (
      <div className="animate-fade-in">
        <PageHeader
          title="Dashboard"
          description="Your meetup command center"
          actions={
            canCreate ? (
              <Link href="/events/new">
                <Button size="md">
                  <Plus className="h-4 w-4" />
                  New Event
                </Button>
              </Link>
            ) : undefined
          }
        />
        <BentoGrid className="lg:grid-cols-3 xl:grid-cols-4">
          <div className="md:col-span-2">
            <CardSkeleton className="h-44" />
          </div>
          <CardSkeleton className="h-24" />
          <CardSkeleton className="h-24" />
          <div className="md:col-span-2">
            <div className="rounded-xl border border-border bg-surface p-0 overflow-hidden">
              <div className="px-5 pt-5 pb-3 flex items-center justify-between">
                <div className="h-4 w-24 rounded bg-surface-active animate-shimmer" />
                <div className="h-3 w-12 rounded bg-surface-active animate-shimmer" />
              </div>
              <div className="divide-y divide-border">
                {[1, 2, 3, 4].map((i) => (
                  <TableRowSkeleton key={i} />
                ))}
              </div>
            </div>
          </div>
          <CardSkeleton className="h-36" />
          <CardSkeleton className="h-24" />
          <CardSkeleton className="h-24" />
          <div className="md:col-span-2">
            <CardSkeleton className="h-48" />
          </div>
        </BentoGrid>
      </div>
    );
  }

  if (error) {
    return (
      <div className="animate-fade-in">
        <PageHeader title="Dashboard" description="Your meetup command center" />
        <EmptyState
          icon={AlertTriangle}
          title="Unable to load dashboard"
          description={error}
        />
      </div>
    );
  }

  const { nextEvent, myTasks, overdueTasks, stats, recentActivity } = data!;
  const hasAnyData =
    nextEvent || myTasks.length > 0 || overdueTasks.length > 0 || stats.totalEvents > 0 || recentActivity.length > 0;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Dashboard"
        description="Your meetup command center"
        actions={
          canCreate ? (
            <Link href="/events/new">
              <Button size="md">
                <Plus className="h-4 w-4" />
                New Event
              </Button>
            </Link>
          ) : undefined
        }
      />

      {!hasAnyData ? (
        isVolunteer ? (
          <EmptyState
            icon={Calendar}
            title="No events assigned"
            description="Seems you are not assigned to events — Contact the Leads to add to an event"
          />
        ) : (
          <EmptyState
            icon={Calendar}
            title="No data yet"
            description="Create your first event to see stats and tasks here."
            action={
              canCreate ? (
                <Link href="/events/new">
                  <Button size="md">
                    <Plus className="h-4 w-4" />
                    Create Event
                  </Button>
                </Link>
              ) : undefined
            }
          />
        )
      ) : (
        <BentoGrid className="lg:grid-cols-3 xl:grid-cols-4">
          {/* Hero: Next Event */}
          <BentoCard colSpan={2} className="relative overflow-hidden">
            {nextEvent ? (
              <>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-accent mb-1">
                      {new Date(nextEvent.date).toDateString() === new Date().toDateString() ? "Today's Event" : "Next Event"}
                    </p>
                    <h2 className="text-xl font-semibold font-[family-name:var(--font-display)] tracking-tight">
                      {nextEvent.title}
                    </h2>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-xs text-muted flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDateTime(nextEvent.date, globalTimezone)}
                      </span>
                      {nextEvent.venue && (
                        <span className="text-xs text-muted">{nextEvent.venue}</span>
                      )}
                      <StatusBadge type="event" status={nextEvent.status} />
                    </div>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-muted">SOP Progress</span>
                    <span className="text-xs font-[family-name:var(--font-mono)] text-foreground">
                      {nextEvent.tasksCompleted}/{nextEvent.tasksTotal} tasks
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-surface-active overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-accent to-amber-400 transition-all duration-700 ease-out"
                      style={{ width: `${nextEvent.progress}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-4">
                  <Link href={`/events/${nextEvent.id}`}>
                    <Button variant="secondary" size="sm">
                      View Event
                      <ArrowRight className="h-3 w-3" />
                    </Button>
                  </Link>
                </div>

                <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-accent/5 blur-3xl pointer-events-none" />
              </>
            ) : (
              <EmptyState
                icon={Calendar}
                title="No upcoming events"
                description={isVolunteer ? "No upcoming events assigned to you yet." : "Create an event to get started."}
                action={
                  canCreate ? (
                    <Link href="/events/new">
                      <Button size="sm">New Event</Button>
                    </Link>
                  ) : undefined
                }
                className="py-8"
              />
            )}
          </BentoCard>

          {/* Event Stats */}
          <BentoCard className="p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Events</p>
              <div className="rounded-lg bg-accent/10 p-2">
                <Calendar className="h-4 w-4 text-accent" />
              </div>
            </div>
            <p className="text-2xl font-semibold font-[family-name:var(--font-display)] tracking-tight">{stats.totalEvents}</p>
            <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border text-xs">
              {stats.todayEvents > 0 && (
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
                  <span className="text-accent font-medium">{stats.todayEvents} today</span>
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-status-progress" />
                <span className="text-muted">{stats.upcomingEvents} upcoming</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-muted/40" />
                <span className="text-muted">{stats.pastEvents} past</span>
              </span>
            </div>
          </BentoCard>

          {/* Speakers */}
          <StatCard
            label="Speakers"
            value={stats.totalSpeakers}
            icon={Mic2}
          />

          {/* My Tasks */}
          <BentoCard colSpan={2} className="p-0">
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <h3 className="text-sm font-semibold font-[family-name:var(--font-display)] uppercase tracking-wide text-muted">
                My Tasks
              </h3>
              <span className="text-xs font-[family-name:var(--font-mono)] text-muted">
                {myTasks.length} items
              </span>
            </div>
            <div className="divide-y divide-border">
              {myTasks.length === 0 ? (
                <div className="px-5 py-8 flex flex-col items-center justify-center text-center">
                  <ClipboardCheck className="h-8 w-8 text-muted mb-2" />
                  <p className="text-sm text-muted">No tasks assigned to you</p>
                </div>
              ) : (
                myTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-surface-hover transition-colors group"
                  >
                    <button
                      onClick={() => toggleTaskDone(task)}
                      disabled={completingTaskId === task.id}
                      className={cn(
                        "h-5 w-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors cursor-pointer",
                        task.status === "DONE"
                          ? "bg-status-done border-status-done"
                          : "border-border hover:border-accent",
                        completingTaskId === task.id && "opacity-50 cursor-wait"
                      )}
                      title={task.status === "DONE" ? "Mark as to-do" : "Mark as done"}
                    >
                      {task.status === "DONE" && <Check className="h-3 w-3 text-white" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-sm truncate", task.status === "DONE" && "line-through text-muted")}>
                        {task.title}
                      </p>
                      <Link
                        href={`/events/${task.eventId}`}
                        className="text-[11px] text-muted hover:text-accent transition-colors truncate block"
                      >
                        {task.eventTitle}
                      </Link>
                    </div>
                    <PriorityBadge priority={task.priority as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"} />
                    <StatusBadge type="task" status={task.status} />
                    <span className="text-[11px] font-[family-name:var(--font-mono)] text-muted w-20 text-right shrink-0">
                      {task.deadline ? formatDate(task.deadline, globalTimezone) : "—"}
                    </span>
                  </div>
                ))
              )}
            </div>
          </BentoCard>

          {/* Overdue */}
          <BentoCard colSpan={1} className="border-status-blocked/30">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-4 w-4 text-status-blocked" />
              <h3 className="text-sm font-semibold font-[family-name:var(--font-display)] text-status-blocked">
                Overdue
              </h3>
              <span className="ml-auto text-xs font-[family-name:var(--font-mono)] text-status-blocked">
                {overdueTasks.length}
              </span>
            </div>
            <div className="space-y-2">
              {overdueTasks.length === 0 ? (
                <p className="text-sm text-muted">No overdue tasks</p>
              ) : (
                overdueTasks.map((item) => (
                  <div key={item.id} className="flex items-center gap-2 text-sm">
                    <OwnerAvatar name={item.owner} size="sm" />
                    <span className="flex-1 truncate">{item.title}</span>
                    <span className="text-[10px] font-[family-name:var(--font-mono)] text-status-blocked">
                      {item.deadline ? formatDate(item.deadline, globalTimezone) : "—"}
                    </span>
                  </div>
                ))
              )}
            </div>
          </BentoCard>

          {/* Volunteers */}
          <StatCard
            label="Volunteers"
            value={stats.totalVolunteers}
            icon={Users}
          />

          {/* Recent Activity */}
          <BentoCard colSpan={2}>
            <h3 className="text-sm font-semibold font-[family-name:var(--font-display)] uppercase tracking-wide text-muted mb-3">
              Recent Activity
            </h3>
            <div className="space-y-3">
              {recentActivity.length === 0 ? (
                <p className="text-sm text-muted">No recent activity</p>
              ) : (
                recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-start gap-3">
                    <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-accent shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{activitySummary(activity)}</p>
                      <p className="text-[11px] font-[family-name:var(--font-mono)] text-muted">
                        {formatTimeAgo(activity.createdAt)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </BentoCard>
        </BentoGrid>
      )}
    </div>
  );
}
