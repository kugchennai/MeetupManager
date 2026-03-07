"use client";

import { PageHeader } from "@/components/design-system";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Crown,
  Eye,
  Hand,
  Users,
  Calendar,
  Mic2,
  Building2,
  ClipboardCheck,
  Settings,
  ScrollText,
  Mail,
  Bot,
  Check,
  X,
  Minus,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Role definitions ─────────────────────────────────────────────

const ROLES = [
  {
    key: "VIEWER",
    label: "Viewer",
    level: 0,
    icon: Eye,
    color: "text-muted",
    bg: "bg-muted/10",
    description: "Read-only access to events and dashboard",
  },
  {
    key: "VOLUNTEER",
    label: "Volunteer",
    level: 1,
    icon: Hand,
    color: "text-blue-400",
    bg: "bg-blue-400/10",
    description: "Can view assigned events and manage their own tasks",
  },
  {
    key: "EVENT_LEAD",
    label: "Member",
    level: 2,
    icon: Shield,
    color: "text-accent",
    bg: "bg-accent/10",
    description: "Core team member — can create and manage events, speakers, volunteers, and venues. Displayed as \"Member\" in the UI.",
    alias: "EVENT_LEAD",
  },
  {
    key: "ADMIN",
    label: "Admin",
    level: 3,
    icon: ShieldCheck,
    color: "text-emerald-400",
    bg: "bg-emerald-400/10",
    description: "Full team management, templates, audit logs, and integrations",
  },
  {
    key: "SUPER_ADMIN",
    label: "Super Admin",
    level: 4,
    icon: Crown,
    color: "text-amber-400",
    bg: "bg-amber-400/10",
    description: "Complete control including member deletion and app settings",
  },
] as const;

// ─── Permission matrix ───────────────────────────────────────────

type Access = "full" | "limited" | "none";

interface PermissionRow {
  feature: string;
  icon: React.ComponentType<{ className?: string }>;
  actions: Record<string, Access>;
  note?: string;
}

const PERMISSIONS: PermissionRow[] = [
  {
    feature: "Dashboard",
    icon: Calendar,
    actions: {
      VIEWER: "full",
      VOLUNTEER: "limited",
      EVENT_LEAD: "full",
      ADMIN: "full",
      SUPER_ADMIN: "full",
    },
    note: "Volunteers see scoped stats for their assigned events only",
  },
  {
    feature: "View Events",
    icon: Calendar,
    actions: {
      VIEWER: "full",
      VOLUNTEER: "limited",
      EVENT_LEAD: "full",
      ADMIN: "full",
      SUPER_ADMIN: "full",
    },
    note: "Volunteers see only events they're assigned to",
  },
  {
    feature: "Create Events",
    icon: Calendar,
    actions: {
      VIEWER: "none",
      VOLUNTEER: "none",
      EVENT_LEAD: "full",
      ADMIN: "full",
      SUPER_ADMIN: "full",
    },
  },
  {
    feature: "Edit / Delete Events",
    icon: Calendar,
    actions: {
      VIEWER: "none",
      VOLUNTEER: "none",
      EVENT_LEAD: "limited",
      ADMIN: "limited",
      SUPER_ADMIN: "full",
    },
    note: "Edit: Event members with ORGANIZER/LEAD role. Delete: Event creator (if Admin/Super Admin) or Super Admin (any event)",
  },
  {
    feature: "Speakers",
    icon: Mic2,
    actions: {
      VIEWER: "none",
      VOLUNTEER: "none",
      EVENT_LEAD: "full",
      ADMIN: "full",
      SUPER_ADMIN: "full",
    },
    note: "Create, edit, delete, and link to events",
  },
  {
    feature: "Venue Partners",
    icon: Building2,
    actions: {
      VIEWER: "none",
      VOLUNTEER: "none",
      EVENT_LEAD: "full",
      ADMIN: "full",
      SUPER_ADMIN: "full",
    },
    note: "Create, edit, delete, and link to events",
  },
  {
    feature: "Volunteers",
    icon: Users,
    actions: {
      VIEWER: "none",
      VOLUNTEER: "none",
      EVENT_LEAD: "full",
      ADMIN: "full",
      SUPER_ADMIN: "full",
    },
    note: "Create, edit, delete, and assign to events",
  },
  {
    feature: "Promote Volunteer → Member",
    icon: Users,
    actions: {
      VIEWER: "none",
      VOLUNTEER: "none",
      EVENT_LEAD: "none",
      ADMIN: "full",
      SUPER_ADMIN: "full",
    },
  },
  {
    feature: "SOP Tasks (own)",
    icon: ClipboardCheck,
    actions: {
      VIEWER: "none",
      VOLUNTEER: "limited",
      EVENT_LEAD: "full",
      ADMIN: "full",
      SUPER_ADMIN: "full",
    },
    note: "Volunteers can toggle task status and self-assign on their assigned events",
  },
  {
    feature: "SOP Templates",
    icon: ClipboardCheck,
    actions: {
      VIEWER: "none",
      VOLUNTEER: "none",
      EVENT_LEAD: "limited",
      ADMIN: "full",
      SUPER_ADMIN: "full",
    },
    note: "Event Leads can view templates; Admins can create, edit, and delete",
  },
  {
    feature: "Change Event Template",
    icon: ClipboardCheck,
    actions: {
      VIEWER: "none",
      VOLUNTEER: "none",
      EVENT_LEAD: "none",
      ADMIN: "full",
      SUPER_ADMIN: "full",
    },
  },
  {
    feature: "Members Management",
    icon: Users,
    actions: {
      VIEWER: "none",
      VOLUNTEER: "none",
      EVENT_LEAD: "none",
      ADMIN: "limited",
      SUPER_ADMIN: "full",
    },
    note: "Admins can add members and change roles (except ADMIN role). Only Super Admin can assign ADMIN role or delete members.",
  },
  {
    feature: "Audit Log",
    icon: ScrollText,
    actions: {
      VIEWER: "none",
      VOLUNTEER: "none",
      EVENT_LEAD: "none",
      ADMIN: "full",
      SUPER_ADMIN: "full",
    },
  },
  {
    feature: "Email & Test Email",
    icon: Mail,
    actions: {
      VIEWER: "none",
      VOLUNTEER: "none",
      EVENT_LEAD: "none",
      ADMIN: "full",
      SUPER_ADMIN: "full",
    },
  },
  {
    feature: "Public Code of Conduct (View)",
    icon: ScrollText,
    actions: {
      VIEWER: "full",
      VOLUNTEER: "full",
      EVENT_LEAD: "full",
      ADMIN: "full",
      SUPER_ADMIN: "full",
    },
    note: "Accessible at /docs/code-of-conduct for both signed-in users and public visitors",
  },
  {
    feature: "Public Code of Conduct (Edit)",
    icon: ScrollText,
    actions: {
      VIEWER: "none",
      VOLUNTEER: "none",
      EVENT_LEAD: "none",
      ADMIN: "none",
      SUPER_ADMIN: "full",
    },
    note: "Only Super Admin can edit/publish content changes",
  },
  {
    feature: "Discord Integration",
    icon: Bot,
    actions: {
      VIEWER: "none",
      VOLUNTEER: "none",
      EVENT_LEAD: "none",
      ADMIN: "full",
      SUPER_ADMIN: "full",
    },
  },
  {
    feature: "App Settings",
    icon: Settings,
    actions: {
      VIEWER: "none",
      VOLUNTEER: "none",
      EVENT_LEAD: "none",
      ADMIN: "none",
      SUPER_ADMIN: "full",
    },
    note: "Meetup name, volunteer thresholds, minimum tasks, and logos (Super Admin only)",
  },
  {
    feature: "Venue Request CC Settings",
    icon: Mail,
    actions: {
      VIEWER: "none",
      VOLUNTEER: "none",
      EVENT_LEAD: "none",
      ADMIN: "limited",
      SUPER_ADMIN: "full",
    },
    note: "Default CC in Settings is Super Admin only. Admins can still add/edit CC recipients while composing a venue request email.",
  },
];

// ─── Event-level roles ───────────────────────────────────────────

const EVENT_ROLES = [
  {
    role: "Viewer",
    level: 0,
    permissions: ["View event details"],
  },
  {
    role: "Volunteer",
    level: 1,
    permissions: ["View event details", "Toggle own task status", "Self-assign tasks"],
  },
  {
    role: "Organizer",
    level: 2,
    permissions: [
      "Everything Volunteer can do",
      "Create and edit tasks",
      "Manage speakers, volunteers, and venues for the event",
    ],
  },
  {
    role: "Lead",
    level: 3,
    permissions: [
      "Everything Organizer can do",
      "Delete tasks and checklists",
      "Full event management",
    ],
  },
];

// ─── Components ──────────────────────────────────────────────────

function AccessIcon({ access }: { access: Access }) {
  if (access === "full")
    return <Check className="h-4 w-4 text-status-done" />;
  if (access === "limited")
    return <Minus className="h-4 w-4 text-amber-400" />;
  return <X className="h-4 w-4 text-muted/40" />;
}

function AccessLabel({ access }: { access: Access }) {
  if (access === "full")
    return <span className="text-xs text-status-done font-medium">Full</span>;
  if (access === "limited")
    return <span className="text-xs text-amber-400 font-medium">Limited</span>;
  return <span className="text-xs text-muted/40">—</span>;
}

export default function PermissionsPage() {
  const { data: session } = useSession();
  const currentRole = session?.user?.globalRole;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Permissions & Access"
        description="Transparency into who can do what across the platform"
      />

      {/* Current user role badge */}
      {currentRole && (
        <div className="mb-6">
          <div className="inline-flex items-center gap-2 bg-surface border border-border rounded-lg px-4 py-2.5">
            <ShieldAlert className="h-4 w-4 text-accent" />
            <span className="text-sm">
              Your role:{" "}
              <strong className="text-accent">
                {ROLES.find((r) => r.key === currentRole)?.label ?? currentRole}
              </strong>
            </span>
          </div>
        </div>
      )}

      {/* ── Quick Links ── */}
      <div className="mb-8">
        <Link
          href="/settings/permissions/email-workflows"
          className="group flex items-center gap-4 bg-surface border border-border rounded-xl p-5 hover:border-accent/30 hover:bg-surface-hover transition-all"
        >
          <div className="p-2.5 rounded-lg bg-amber-400/10 text-amber-400 group-hover:bg-amber-400/20 transition-colors">
            <Mail className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm mb-0.5 group-hover:text-accent transition-colors">Email Workflows</h3>
            <p className="text-xs text-muted">Complete reference for all 11 automated email notifications — who receives what and when</p>
          </div>
          <ArrowRight className="h-4 w-4 text-muted group-hover:text-accent group-hover:translate-x-0.5 transition-all shrink-0" />
        </Link>
      </div>

      {/* ── Role Hierarchy ── */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-4">Global Roles</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ROLES.map((role) => {
            const Icon = role.icon;
            const isCurrent = currentRole === role.key;
            return (
              <div
                key={role.key}
                className={cn(
                  "bg-surface border rounded-xl p-4 transition-colors",
                  isCurrent
                    ? "border-accent/40 ring-1 ring-accent/20"
                    : "border-border"
                )}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className={cn("p-2 rounded-lg", role.bg)}>
                    <Icon className={cn("h-4 w-4", role.color)} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{role.label}</span>
                      {"alias" in role && role.alias && (
                        <span className="text-[10px] font-mono text-muted/60 bg-background px-1.5 py-0.5 rounded">
                          {role.alias}
                        </span>
                      )}
                      <span className="text-[10px] font-mono text-muted bg-background px-1.5 py-0.5 rounded">
                        Level {role.level}
                      </span>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted leading-relaxed">
                  {role.description}
                </p>
                {isCurrent && (
                  <div className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-accent">
                    ← Your role
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Permission Matrix ── */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-4">Permission Matrix</h2>
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-background/50">
                  <th className="text-left py-3 px-4 font-semibold text-xs uppercase tracking-wider text-muted min-w-[200px]">
                    Feature
                  </th>
                  {ROLES.map((role) => (
                    <th
                      key={role.key}
                      className={cn(
                        "py-3 px-3 text-center font-semibold text-xs uppercase tracking-wider min-w-[90px]",
                        currentRole === role.key ? "text-accent" : "text-muted"
                      )}
                    >
                      {role.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERMISSIONS.map((perm, i) => {
                  const Icon = perm.icon;
                  return (
                    <tr
                      key={perm.feature}
                      className={cn(
                        "border-b border-border/50 last:border-0",
                        i % 2 === 0 ? "bg-transparent" : "bg-background/30"
                      )}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Icon className="h-3.5 w-3.5 text-muted flex-shrink-0" />
                          <div>
                            <span className="font-medium text-sm">{perm.feature}</span>
                            {perm.note && (
                              <p className="text-[11px] text-muted leading-snug mt-0.5">
                                {perm.note}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      {ROLES.map((role) => {
                        const access = perm.actions[role.key];
                        const isCurrent = currentRole === role.key;
                        return (
                          <td
                            key={role.key}
                            className={cn(
                              "py-3 px-3 text-center",
                              isCurrent && "bg-accent/5"
                            )}
                          >
                            <div className="flex flex-col items-center gap-0.5">
                              <AccessIcon access={access} />
                              <AccessLabel access={access} />
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-6 mt-3 text-xs text-muted">
          <div className="flex items-center gap-1.5">
            <Check className="h-3.5 w-3.5 text-status-done" />
            <span>Full access</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Minus className="h-3.5 w-3.5 text-amber-400" />
            <span>Limited access</span>
          </div>
          <div className="flex items-center gap-1.5">
            <X className="h-3.5 w-3.5 text-muted/40" />
            <span>No access</span>
          </div>
        </div>
      </section>

      {/* ── Event-Level Roles ── */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-2">Event-Level Roles</h2>
        <p className="text-sm text-muted mb-4">
          When you&apos;re added to a specific event, you receive an event-level role that determines what you can do within that event.
          These apply in addition to your global role.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {EVENT_ROLES.map((er) => (
            <div
              key={er.role}
              className="bg-surface border border-border rounded-xl p-4"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="font-semibold text-sm">{er.role}</span>
                <span className="text-[10px] font-mono text-muted bg-background px-1.5 py-0.5 rounded">
                  Level {er.level}
                </span>
              </div>
              <ul className="space-y-1">
                {er.permissions.map((p) => (
                  <li key={p} className="flex items-start gap-2 text-xs text-muted">
                    <Check className="h-3 w-3 text-status-done mt-0.5 flex-shrink-0" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* ── Key Rules ── */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Key Rules</h2>
        <div className="bg-surface border border-border rounded-xl p-5 space-y-3 text-sm text-muted">
          <div className="flex items-start gap-2">
            <span className="text-accent font-bold mt-0.5">1.</span>
            <p>
              <strong className="text-foreground">Admins and Super Admins</strong> bypass all event-level role checks — they have full access to every event.
            </p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-accent font-bold mt-0.5">2.</span>
            <p>
              <strong className="text-foreground">Only Super Admins</strong> can assign the Admin role, delete members, or change app-wide settings (including default Venue Request CC settings).
            </p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-accent font-bold mt-0.5">3.</span>
            <p>
              <strong className="text-foreground">Admins cannot modify other Admins</strong> — role changes between Admins require Super Admin intervention.
            </p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-accent font-bold mt-0.5">4.</span>
            <p>
              <strong className="text-foreground">Volunteers</strong> can only see events they&apos;re assigned to, and can only manage their own tasks (toggle status, self-assign).
            </p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-accent font-bold mt-0.5">5.</span>
            <p>
              <strong className="text-foreground">Member deletion is a soft-delete</strong> — the account is deactivated but data is preserved. Any owned events or entities must be reassigned first.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
