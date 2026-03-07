"use client";

import { PageHeader, Button, EmptyState, OwnerAvatar, Modal, EventContributions } from "@/components/design-system";
import { Users, Shield, ChevronDown, Plus, Mail, Trash2, AlertTriangle, Pencil } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

interface AdminOption {
  id: string;
  name: string | null;
  email: string | null;
}

interface Member {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  image: string | null;
  globalRole: string;
  createdAt: string;
  events?: Array<{
    eventRole: string;
    status: string;
    event: { id: string; title: string; date: string };
  }>;
  eventsCount?: number;
  ownershipCount?: number;
}

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  EVENT_LEAD: "Member",
  VOLUNTEER: "Volunteer",
  VIEWER: "Temporary Viewer",
};

const ALL_ASSIGNABLE_ROLES: { value: string; label: string }[] = [
  { value: "ADMIN", label: "Admin" },
  { value: "EVENT_LEAD", label: "Member" },
];

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: "text-rose-400",
  ADMIN: "text-accent",
  EVENT_LEAD: "text-status-progress",
  VOLUNTEER: "text-status-done",
  VIEWER: "text-muted",
};

function RoleDropdown({
  currentRole,
  onSelect,
  disabled,
  assignableRoles,
}: {
  currentRole: string;
  onSelect: (role: string) => void;
  disabled?: boolean;
  assignableRoles: { value: string; label: string }[];
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPos({
      top: rect.bottom + 4,
      left: rect.right - 160,
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePosition();

    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      )
        return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      document.removeEventListener("mousedown", handler);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, updatePosition]);

  if (disabled) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium",
          "border border-border",
          ROLE_COLORS[currentRole]
        )}
      >
        <Shield className="h-3 w-3" />
        {ROLE_LABELS[currentRole] ?? currentRole}
      </span>
    );
  }

  return (
    <>
      <button
        ref={triggerRef}
        onClick={() => setOpen(!open)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium",
          "border border-border hover:border-border-hover transition-all cursor-pointer",
          ROLE_COLORS[currentRole]
        )}
      >
        <Shield className="h-3 w-3" />
        {ROLE_LABELS[currentRole] ?? currentRole}
        <ChevronDown className="h-3 w-3 opacity-50" />
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            className="fixed z-[100] w-40 bg-surface border border-border rounded-lg shadow-xl py-1 animate-fade-in"
            style={{ top: pos.top, left: pos.left }}
          >
            {assignableRoles.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => {
                  onSelect(value);
                  setOpen(false);
                }}
                className={cn(
                  "w-full text-left px-3 py-1.5 text-xs font-medium cursor-pointer",
                  "hover:bg-surface-hover transition-colors",
                  value === currentRole ? "text-accent" : "text-foreground"
                )}
              >
                {label}
              </button>
            ))}
          </div>,
          document.body
        )}
    </>
  );
}

const INPUT_CLASS =
  "w-full bg-background border border-border rounded-lg px-3.5 py-2.5 text-sm placeholder:text-muted/50 focus:border-accent focus:ring-1 focus:ring-accent/30 outline-none transition-all";

function AddMemberModal({
  open,
  onClose,
  onAdded,
  assignableRoles,
}: {
  open: boolean;
  onClose: () => void;
  onAdded: (member: Member) => void;
  assignableRoles: { value: string; label: string }[];
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("EVENT_LEAD");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !name.trim() || !phone.trim()) return;

    setSaving(true);
    setError(null);

    const res = await fetch("/api/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: email.trim(),
        name: name.trim() || undefined,
        phone: phone.trim(),
        globalRole: role,
      }),
    });

    if (res.ok) {
      const member = await res.json();
      onAdded(member);
      setEmail("");
      setName("");
      setPhone("");
      setRole("EVENT_LEAD");
      onClose();
    } else {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Failed to add member");
    }
    setSaving(false);
  };

  return (
    <Modal open={open} onClose={onClose} className="p-6">
      <h2 className="text-lg font-semibold font-[family-name:var(--font-display)] mb-4">
        Add Member
      </h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1.5">Email *</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="member@example.com"
              required
              autoFocus
              className={cn(INPUT_CLASS, "pl-9")}
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5">Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name"
            required
            className={INPUT_CLASS}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5">Phone *</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+1 (555) 000-0000"
            required
            className={INPUT_CLASS}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5">Role</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className={INPUT_CLASS}
          >
            {assignableRoles.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        {error && (
          <p className="text-sm text-status-blocked bg-status-blocked/10 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Adding…" : "Add Member"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function RemoveMemberModal({
  open,
  onClose,
  member,
  onRemoved,
}: {
  open: boolean;
  onClose: () => void;
  member: Member | null;
  onRemoved: (id: string) => void;
}) {
  const [admins, setAdmins] = useState<AdminOption[]>([]);
  const [reassignToUserId, setReassignToUserId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingAdmins, setLoadingAdmins] = useState(false);

  const hasOwnership = (member?.ownershipCount ?? 0) > 0;

  useEffect(() => {
    if (!open || !member || !hasOwnership) return;
    setLoadingAdmins(true);
    fetch("/api/members/list")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: AdminOption[]) => {
        setAdmins(data.filter((a) => a.id !== member.id));
      })
      .catch(() => setAdmins([]))
      .finally(() => setLoadingAdmins(false));
  }, [open, member, hasOwnership]);

  useEffect(() => {
    if (!open) {
      setReassignToUserId("");
      setError(null);
    }
  }, [open]);

  const handleRemove = async () => {
    if (!member) return;
    if (hasOwnership && !reassignToUserId) return;

    setSaving(true);
    setError(null);

    const res = await fetch("/api/members", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: member.id,
        ...(reassignToUserId ? { reassignToUserId } : {}),
      }),
    });

    if (res.ok) {
      onRemoved(member.id);
      onClose();
    } else {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Failed to remove member");
    }
    setSaving(false);
  };

  if (!member) return null;

  return (
    <Modal open={open} onClose={onClose} className="p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-10 w-10 rounded-full bg-status-blocked/15 flex items-center justify-center">
          <AlertTriangle className="h-5 w-5 text-status-blocked" />
        </div>
        <div>
          <h2 className="text-lg font-semibold font-[family-name:var(--font-display)]">
            Remove Member
          </h2>
          <p className="text-sm text-muted">This action can be undone by re-adding the member.</p>
        </div>
      </div>

      <div className="bg-surface-hover rounded-lg px-4 py-3 mb-4">
        <div className="flex items-center gap-3">
          <OwnerAvatar name={member.name} image={member.image} size="md" />
          <div>
            <p className="text-sm font-medium">{member.name ?? "Unnamed"}</p>
            <p className="text-xs text-muted">{member.email ?? "—"}</p>
          </div>
          <span
            className={cn(
              "ml-auto inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium border border-border",
              ROLE_COLORS[member.globalRole]
            )}
          >
            <Shield className="h-3 w-3" />
            {ROLE_LABELS[member.globalRole] ?? member.globalRole}
          </span>
        </div>
      </div>

      {hasOwnership && (
        <div className="space-y-3 mb-4">
          <div className="flex items-start gap-2 text-sm text-status-progress bg-status-progress/10 rounded-lg px-3 py-2.5">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              This member owns <strong>{member.ownershipCount}</strong> event{(member.ownershipCount ?? 0) !== 1 ? "s" : ""} / task{(member.ownershipCount ?? 0) !== 1 ? "s" : ""}.
              All ownership will be reassigned to the selected admin.
            </span>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Reassign responsibilities to *
            </label>
            {loadingAdmins ? (
              <div className="h-10 rounded-lg animate-shimmer" />
            ) : (
              <select
                value={reassignToUserId}
                onChange={(e) => setReassignToUserId(e.target.value)}
                className={INPUT_CLASS}
                required
              >
                <option value="">Select an admin…</option>
                {admins.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name ?? a.email ?? "Unnamed"}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      )}

      {!hasOwnership && (
        <p className="text-sm text-muted mb-4">
          Are you sure you want to remove <strong>{member.name ?? member.email ?? "this member"}</strong>?
          They will lose access to the platform and all their active sessions will be invalidated.
        </p>
      )}

      {error && (
        <p className="text-sm text-status-blocked bg-status-blocked/10 rounded-lg px-3 py-2 mb-4">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="button"
          onClick={handleRemove}
          disabled={saving || (hasOwnership && !reassignToUserId)}
          className="!bg-status-blocked/15 !text-status-blocked hover:!bg-status-blocked/25 !border-status-blocked/20"
        >
          {saving ? "Removing…" : "Remove Member"}
        </Button>
      </div>
    </Modal>
  );
}

function EditMemberModal({
  open,
  onClose,
  member,
  onUpdated,
}: {
  open: boolean;
  onClose: () => void;
  member: Member | null;
  onUpdated: (updated: Member) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && member) {
      setName(member.name ?? "");
      setPhone(member.phone ?? "");
      setError(null);
    }
  }, [open, member]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!member || !name.trim() || !phone.trim()) return;

    setSaving(true);
    setError(null);

    const res = await fetch("/api/members", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: member.id, name: name.trim(), phone: phone.trim() || undefined }),
    });

    if (res.ok) {
      const updated = await res.json();
      onUpdated({ ...member, ...updated });
      onClose();
    } else {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Failed to update member");
    }
    setSaving(false);
  };

  if (!member) return null;

  return (
    <Modal open={open} onClose={onClose} className="p-6">
      <h2 className="text-lg font-semibold font-[family-name:var(--font-display)] mb-4">
        Edit Member
      </h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1.5">Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name"
            required
            autoFocus
            className={INPUT_CLASS}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5">Phone *</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+1 (555) 000-0000"
            required
            className={INPUT_CLASS}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5 text-muted">Email</label>
          <p className="text-sm text-muted">{member.email ?? "—"}</p>
        </div>
        {error && (
          <p className="text-sm text-status-blocked bg-status-blocked/10 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving || !name.trim() || !phone.trim()}>
            {saving ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default function MembersPage() {
  const { data: session } = useSession();
  const myRole = session?.user?.globalRole ?? "VIEWER";
  const isSuperAdmin = myRole === "SUPER_ADMIN";
  const assignableRoles = isSuperAdmin
    ? ALL_ASSIGNABLE_ROLES
    : ALL_ASSIGNABLE_ROLES.filter((r) => r.value !== "ADMIN");
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<Member | null>(null);
  const [editTarget, setEditTarget] = useState<Member | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    fetch("/api/members")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Member[]) => setMembers(data))
      .catch(() => setMembers([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const updateRole = async (userId: string, globalRole: string) => {
    const prev = members.find((m) => m.id === userId)?.globalRole;
    setMembers((ms) =>
      ms.map((m) => (m.id === userId ? { ...m, globalRole } : m))
    );

    const res = await fetch("/api/members", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, globalRole }),
    });

    if (res.ok) {
      const updated = await res.json();
      setMembers((ms) =>
        ms.map((m) => (m.id === updated.id ? { ...m, globalRole: updated.globalRole } : m))
      );
      setToast({ message: `Role updated to ${ROLE_LABELS[globalRole] ?? globalRole}`, type: "success" });
    } else {
      setMembers((ms) =>
        ms.map((m) => (m.id === userId ? { ...m, globalRole: prev ?? m.globalRole } : m))
      );
      const data = await res.json().catch(() => null);
      setToast({ message: data?.error ?? "Failed to update role", type: "error" });
    }
  };

  return (
    <div className="animate-fade-in">
      {toast && (
        <div
          className={cn(
            "fixed top-4 right-4 z-[200] rounded-lg px-4 py-2.5 text-sm font-medium shadow-lg animate-fade-in",
            toast.type === "success"
              ? "bg-status-done/15 text-status-done border border-status-done/20"
              : "bg-status-blocked/15 text-status-blocked border border-status-blocked/20"
          )}
        >
          {toast.message}
        </div>
      )}

      <PageHeader
        title="Members"
        description="Manage user roles and permissions"
        actions={
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Add Member
          </Button>
        }
      />

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-4 rounded-xl bg-surface border border-border">
              <div className="h-8 w-8 rounded-full animate-shimmer" />
              <div className="h-4 w-32 rounded animate-shimmer" />
              <div className="ml-auto h-6 w-20 rounded animate-shimmer" />
            </div>
          ))}
        </div>
      ) : members.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No members yet"
          description="Add team members by email to get started."
          action={
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Add Member
            </Button>
          }
        />
      ) : (
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <div className={cn(
            "grid gap-4 px-5 py-3 border-b border-border text-[10px] font-semibold uppercase tracking-widest text-muted",
            isSuperAdmin
              ? "grid-cols-[auto_1fr_1fr_1fr_auto_auto_auto_auto]"
              : "grid-cols-[auto_1fr_1fr_1fr_auto_auto_auto]"
          )}>
            <span />
            <span>Name</span>
            <span>Email</span>
            <span>Phone</span>
            <span>Role</span>
            <span>Events</span>
            <span>Joined</span>
            {isSuperAdmin && <span />}
          </div>
          {members.map((member) => {
            const canRemove =
              isSuperAdmin &&
              member.globalRole !== "SUPER_ADMIN" &&
              member.id !== session?.user?.id;
            return (
            <div
              key={member.id}
              className={cn(
                "group grid gap-4 items-center px-5 py-3 border-b border-border last:border-0 hover:bg-surface-hover transition-colors",
                isSuperAdmin
                  ? "grid-cols-[auto_1fr_1fr_1fr_auto_auto_auto_auto]"
                  : "grid-cols-[auto_1fr_1fr_1fr_auto_auto_auto]"
              )}
            >
              <OwnerAvatar name={member.name} image={member.image} size="md" />
              <span className="text-sm font-medium truncate flex items-center gap-1.5">
                {member.name ?? "—"}
                <button
                  onClick={() => setEditTarget(member)}
                  className="p-1 rounded-md text-muted hover:text-accent hover:bg-accent/10 transition-all cursor-pointer opacity-0 group-hover:opacity-100"
                  title="Edit name"
                >
                  <Pencil className="h-3 w-3" />
                </button>
              </span>
              <span className="text-sm text-muted truncate">{member.email ?? "—"}</span>
              <span className="text-sm text-muted truncate">{member.phone ?? "—"}</span>
              <RoleDropdown
                currentRole={member.globalRole}
                onSelect={(role) => updateRole(member.id, role)}
                assignableRoles={assignableRoles}
                disabled={
                  member.globalRole === "SUPER_ADMIN" ||
                  member.id === session?.user?.id ||
                  (myRole === "ADMIN" && member.globalRole === "ADMIN")
                }
              />
              <EventContributions
                events={(member.events ?? []).map((e) => ({
                  ...e,
                  roleLabel: e.eventRole ?? undefined,
                }))}
                statusType="event"
              />
              <span className="text-[11px] font-[family-name:var(--font-mono)] text-muted">
                {new Date(member.createdAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
              {isSuperAdmin && (
                <div className="flex justify-end">
                  {canRemove ? (
                    <button
                      onClick={() => setRemoveTarget(member)}
                      className="p-1.5 rounded-lg text-muted hover:text-status-blocked hover:bg-status-blocked/10 transition-all cursor-pointer"
                      title="Remove member"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  ) : (
                    <span className="w-[26px]" />
                  )}
                </div>
              )}
            </div>
            );
          })}
        </div>
      )}

      <AddMemberModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdded={(member) => setMembers((prev) => [member, ...prev])}
        assignableRoles={assignableRoles}
      />

      <RemoveMemberModal
        open={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        member={removeTarget}
        onRemoved={(id) => {
          setMembers((prev) => prev.filter((m) => m.id !== id));
          setToast({ message: "Member removed successfully", type: "success" });
        }}
      />

      <EditMemberModal
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        member={editTarget}
        onUpdated={(updated) => {
          setMembers((prev) =>
            prev.map((m) => (m.id === updated.id ? { ...m, ...updated } : m))
          );
          setToast({ message: "Member updated successfully", type: "success" });
        }}
      />
    </div>
  );
}
