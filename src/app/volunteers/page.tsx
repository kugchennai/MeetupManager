"use client";

import { PageHeader, EmptyState, Button, Modal, EventContributions } from "@/components/design-system";
import { Users, Plus, Pencil, Trash2, X, UserPlus } from "lucide-react";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface Volunteer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  discordId: string | null;
  role: string | null;
  userId: string | null;
  user?: { id: string; name: string | null; image: string | null } | null;
  createdAt: string;
  updatedAt: string;
  eventsCount?: number;
  events?: Array<{
    status: string;
    event: { id: string; title: string; date: string };
  }>;
}

const inputClassName =
  "w-full bg-background border border-border rounded-lg px-3.5 py-2.5 text-sm placeholder:text-muted/50 focus:border-accent focus:ring-1 focus:ring-accent/30 outline-none transition-all";

function VolunteerFormModal({
  volunteer,
  onClose,
  onSuccess,
}: {
  volunteer: Volunteer | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState(volunteer?.name ?? "");
  const [email, setEmail] = useState(volunteer?.email ?? "");
  const [phone, setPhone] = useState(volunteer?.phone ?? "");
  const [discordId, setDiscordId] = useState(volunteer?.discordId ?? "");
  const [role, setRole] = useState(volunteer?.role ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = !!volunteer;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    if (!email.trim()) {
      setError("Email is required");
      return;
    }
    if (!phone.trim()) {
      setError("Phone number is required");
      return;
    }
    setSubmitting(true);
    try {
      const url = isEdit ? `/api/volunteers/${volunteer.id}` : "/api/volunteers";
      const method = isEdit ? "PATCH" : "POST";
      const body = {
        name: name.trim(),
        ...(isEdit ? {} : { email: email.trim() || undefined }),
        phone: phone.trim() || undefined,
        discordId: discordId.trim() || undefined,
        role: role.trim() || undefined,
      };
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Request failed");
      }
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open onClose={onClose}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <h2 className="text-lg font-semibold font-[family-name:var(--font-display)]">
          {isEdit ? "Edit Volunteer" : "Add Volunteer"}
        </h2>
        <button
          onClick={onClose}
          className="p-2 rounded-lg text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-status-blocked/10 border border-status-blocked/20 text-status-blocked text-sm">
            {error}
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Name <span className="text-status-blocked">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Volunteer name"
            className={inputClassName}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Email {!isEdit && <span className="text-status-blocked">*</span>}
          </label>
          {isEdit ? (
            <p className="text-sm text-muted px-3.5 py-2.5 bg-surface-hover border border-border rounded-lg">
              {email || "—"}
            </p>
          ) : (
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="volunteer@example.com"
              className={inputClassName}
              required
            />
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Phone <span className="text-status-blocked">*</span>
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+1 (555) 000-0000"
            className={inputClassName}
            required={!isEdit}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Discord ID</label>
          <input
            type="text"
            value={discordId}
            onChange={(e) => setDiscordId(e.target.value)}
            placeholder="Discord username or ID"
            className={inputClassName}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Role</label>
          <input
            type="text"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="e.g. Logistics, AV, Registration"
            className={inputClassName}
          />
        </div>
        <div className="flex gap-2 pt-2">
          <Button type="submit" disabled={submitting} className="flex-1">
            {submitting ? "Saving…" : isEdit ? "Save" : "Add Volunteer"}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
}

const ROLE_LEVEL: Record<string, number> = { VIEWER: 0, VOLUNTEER: 1, EVENT_LEAD: 2, ADMIN: 3, SUPER_ADMIN: 4 };

export default function VolunteersPage() {
  const { data: session, status } = useSession();
  const nav = useRouter();
  const userRole = session?.user?.globalRole ?? "";
  const hasAccess = (ROLE_LEVEL[userRole] ?? 0) >= ROLE_LEVEL.EVENT_LEAD;

  useEffect(() => {
    if (status === "loading") return;
    if (!hasAccess) nav.replace("/dashboard");
  }, [status, hasAccess, nav]);

  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVolunteer, setModalVolunteer] = useState<Volunteer | null | "add">(null);
  const [promotionThreshold, setPromotionThreshold] = useState(5);
  const [converting, setConverting] = useState<string | null>(null);
  const canConvert = (ROLE_LEVEL[userRole] ?? 0) >= ROLE_LEVEL.ADMIN;

  const fetchVolunteers = async () => {
    try {
      const res = await fetch("/api/volunteers");
      if (res.ok) {
        const data = await res.json();
        setVolunteers(data);
      }
    } catch {
      setVolunteers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVolunteers();
  }, []);

  const deleteVolunteer = async (id: string) => {
    if (!confirm("Remove this volunteer from the directory?")) return;
    const res = await fetch(`/api/volunteers/${id}`, { method: "DELETE" });
    if (res.ok) {
      setVolunteers((prev) => prev.filter((v) => v.id !== id));
    }
  };

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : {}))
      .then((data: Record<string, string>) => {
        if (data.volunteer_promotion_threshold) {
          setPromotionThreshold(parseInt(data.volunteer_promotion_threshold, 10));
        }
      })
      .catch(() => {});
  }, []);

  const convertToMember = async (volunteer: Volunteer) => {
    if (!confirm(`Convert "${volunteer.name}" to a member? This will create a member account for them.`)) return;
    setConverting(volunteer.id);
    try {
      const res = await fetch(`/api/volunteers/${volunteer.id}/convert`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "Failed to convert volunteer");
        return;
      }
      await fetchVolunteers();
    } catch {
      alert("Failed to convert volunteer");
    } finally {
      setConverting(null);
    }
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Volunteers"
        description="Manage your volunteer team"
        actions={
          <Button size="md" onClick={() => setModalVolunteer("add")}>
            <Plus className="h-4 w-4" />
            Add Volunteer
          </Button>
        }
      />

      {modalVolunteer && (
        <VolunteerFormModal
          volunteer={modalVolunteer === "add" ? null : modalVolunteer}
          onClose={() => setModalVolunteer(null)}
          onSuccess={fetchVolunteers}
        />
      )}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 p-4 rounded-xl bg-surface border border-border"
            >
              <div className="h-8 w-8 rounded-full animate-shimmer" />
              <div className="h-4 flex-1 max-w-48 rounded animate-shimmer" />
              <div className="h-4 w-24 rounded animate-shimmer" />
              <div className="h-6 w-16 rounded animate-shimmer" />
            </div>
          ))}
        </div>
      ) : volunteers.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No volunteers yet"
          description="Add volunteers to your team"
          action={
            <Button size="md" onClick={() => setModalVolunteer("add")}>
              <Plus className="h-4 w-4" />
              Add Volunteer
            </Button>
          }
        />
      ) : (
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <div className="grid grid-cols-[1fr_1fr_1fr_1fr_1fr_auto_auto] gap-4 px-5 py-3 border-b border-border text-[10px] font-semibold uppercase tracking-widest text-muted">
            <span>Name</span>
            <span>Email</span>
            <span>Phone</span>
            <span>Discord</span>
            <span>Role</span>
            <span>Events</span>
            <span />
          </div>
          {volunteers.map((volunteer) => (
            <div
              key={volunteer.id}
              className="grid grid-cols-[1fr_1fr_1fr_1fr_1fr_auto_auto] gap-4 items-center px-5 py-3 border-b border-border last:border-0 hover:bg-surface-hover transition-colors"
            >
              <span className="text-sm font-medium truncate">{volunteer.name}</span>
              <span className="text-sm text-muted truncate">{volunteer.email ?? "—"}</span>
              <span className="text-sm text-muted truncate">{volunteer.phone ?? "—"}</span>
              <span className="text-sm text-muted truncate">{volunteer.discordId ?? "—"}</span>
              <span className="text-sm text-muted truncate">{volunteer.role ?? "—"}</span>
              <div className="flex items-center gap-2">
                <EventContributions
                  events={volunteer.events ?? []}
                  statusType="volunteer"
                />
                {canConvert && !volunteer.userId && volunteer.email && (volunteer.eventsCount ?? 0) >= promotionThreshold && (
                  <button
                    onClick={() => convertToMember(volunteer)}
                    disabled={converting === volunteer.id}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full bg-accent/10 text-accent px-2.5 py-1 text-xs font-medium hover:bg-accent/20 transition-colors cursor-pointer",
                      converting === volunteer.id && "opacity-50 pointer-events-none"
                    )}
                    title={`Eligible — Promote to member (${volunteer.eventsCount}/${promotionThreshold} events)`}
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    Promote
                  </button>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setModalVolunteer(volunteer)}
                  className={cn(
                    "p-2 rounded-lg text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
                  )}
                  title="Edit"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => deleteVolunteer(volunteer.id)}
                  className={cn(
                    "p-2 rounded-lg text-muted hover:text-status-blocked hover:bg-status-blocked/10 transition-colors"
                  )}
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
