"use client";

import {
  PageHeader, Button, StatusBadge, PriorityBadge,
  OwnerAvatar, EmptyState, BentoGrid, BentoCard, StatCard, Modal, DateTimePicker,
} from "@/components/design-system";
import {
  ArrowLeft, Calendar, MapPin, Mic2, Users, ClipboardCheck,
  Check, Pencil, Trash2, Plus, CalendarDays, UserPlus, X, Search,
  ChevronDown, ChevronsUpDown, Building2, AlertTriangle, RefreshCw, ExternalLink, Link2, Mail, Send,
} from "lucide-react";
import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { formatDate, formatRelativeDate, formatDateTimeRange, cn } from "@/lib/utils";
import { useAppSettings } from "@/lib/app-settings-context";

type VolunteerOption = { id: string; name: string; email: string | null; role: string | null };
type MemberOption = { id: string; name: string | null; email: string | null; image: string | null; globalRole: string };
type SpeakerOption = { id: string; name: string; email: string | null; topic: string | null };
type VenuePartnerOption = { id: string; name: string; email: string | null; address: string | null; capacity: number | null };

interface EventDetail {
  id: string;
  title: string;
  description: string | null;
  date: string;
  endDate: string;
  venue: string | null;
  pageLink: string | null;
  status: string;
  createdBy: { id: string; name: string | null; image: string | null };
  members: { eventRole: string; user: { id: string; name: string | null; image: string | null } }[];
  speakers: {
    id: string;
    status: string;
    priority: string;
    speaker: { id: string; name: string; email: string | null; topic: string | null };
    owner: { id: string; name: string | null; image: string | null } | null;
  }[];
  volunteers: {
    id: string;
    status: string;
    priority: string;
    assignedRole: string | null;
    volunteer: { id: string; name: string; email: string | null; userId: string | null };
    owner: { id: string; name: string | null; image: string | null } | null;
  }[];
  venuePartners: {
    id: string;
    status: string;
    priority: string;
    cost: string | null;
    notes: string | null;
    confirmationDate: string | null;
    venueRequestSent: boolean;
    venueRequestSentAt: string | null;
    venueRequestGmailUrl: string | null;
    venuePartner: { id: string; name: string; email: string | null; address: string | null; capacity: number | null; contactName: string | null; phone: string | null };
    owner: { id: string; name: string | null; image: string | null } | null;
  }[];
  checklists: {
    id: string;
    title: string;
    tasks: {
      id: string;
      title: string;
      status: string;
      priority: string;
      deadline: string | null;
      owner: { id: string; name: string | null; image: string | null } | null;
      assignee: { id: string; name: string | null; image: string | null } | null;
      volunteerAssignee: { id: string; name: string } | null;
    }[];
  }[];
}

type TaskItem = EventDetail["checklists"][number]["tasks"][number];
type EventVolunteerItem = EventDetail["volunteers"][number];

const INPUT_CLASS =
  "w-full bg-background border border-border rounded-lg px-3.5 py-2.5 text-sm placeholder:text-muted/50 focus:border-accent focus:ring-1 focus:ring-accent/30 outline-none transition-all";

type PickerTab = "members" | "directory";

function VolunteerPicker({
  open,
  onClose,
  volunteers,
  members,
  linkedVolunteerIds,
  linkedMemberIds,
  onLinkVolunteer,
  onLinkMember,
}: {
  open: boolean;
  onClose: () => void;
  volunteers: VolunteerOption[];
  members: MemberOption[];
  linkedVolunteerIds: string[];
  linkedMemberIds: string[];
  onLinkVolunteer: (id: string) => Promise<void>;
  onLinkMember: (userId: string) => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<PickerTab>("members");

  const availableVolunteers = volunteers.filter(
    (v) => !linkedVolunteerIds.includes(v.id) && v.name.toLowerCase().includes(query.toLowerCase())
  );
  const availableMembers = members.filter(
    (m) => !linkedMemberIds.includes(m.id) && (m.name ?? m.email ?? "").toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    if (open) { setQuery(""); setTab("members"); }
  }, [open]);

  return (
    <Modal open={open} onClose={onClose} className="max-w-md max-h-[70vh] flex flex-col">
      <div className="px-5 py-4 border-b border-border shrink-0">
        <h2 className="text-lg font-semibold font-[family-name:var(--font-display)] mb-3">
          Add Volunteer to Event
        </h2>
        <div className="flex gap-1 mb-3">
          <button
            onClick={() => setTab("members")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer",
              tab === "members" ? "bg-accent/15 text-accent" : "text-muted hover:text-foreground hover:bg-surface-hover"
            )}
          >
            From Members
          </button>
          <button
            onClick={() => setTab("directory")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer",
              tab === "directory" ? "bg-accent/15 text-accent" : "text-muted hover:text-foreground hover:bg-surface-hover"
            )}
          >
            From Volunteers
          </button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tab === "members" ? "Search members..." : "Search volunteers..."}
            className={cn(INPUT_CLASS, "pl-9")}
            autoFocus
          />
        </div>
      </div>
      <div className="overflow-y-auto flex-1 py-1">
        {tab === "members" ? (
          availableMembers.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted">
              {members.length === 0
                ? "No members found."
                : query
                  ? "No matching members found."
                  : "All members are already linked."}
            </p>
          ) : (
            availableMembers.map((m) => (
              <button
                key={m.id}
                onClick={async () => {
                  await onLinkMember(m.id);
                  onClose();
                }}
                className="flex items-center gap-3 w-full px-5 py-3 text-left hover:bg-surface-hover transition-colors cursor-pointer"
              >
                <OwnerAvatar name={m.name} image={m.image} size="md" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{m.name ?? m.email}</p>
                  <p className="text-xs text-muted truncate">{m.email}</p>
                </div>
                <Plus className="h-4 w-4 text-muted shrink-0" />
              </button>
            ))
          )
        ) : (
          availableVolunteers.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted">
              {volunteers.length === 0
                ? "No volunteers in directory yet. Add some first."
                : query
                  ? "No matching volunteers found."
                  : "All volunteers are already linked."}
            </p>
          ) : (
            availableVolunteers.map((v) => (
              <button
                key={v.id}
                onClick={async () => {
                  await onLinkVolunteer(v.id);
                  onClose();
                }}
                className="flex items-center gap-3 w-full px-5 py-3 text-left hover:bg-surface-hover transition-colors cursor-pointer"
              >
                <OwnerAvatar name={v.name} size="md" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{v.name}</p>
                  <p className="text-xs text-muted truncate">
                    {v.role ?? v.email ?? "No role"}
                  </p>
                </div>
                <Plus className="h-4 w-4 text-muted shrink-0" />
              </button>
            ))
          )
        )}
      </div>
    </Modal>
  );
}

function SpeakerPicker({
  open,
  onClose,
  speakers,
  linkedIds,
  onLink,
}: {
  open: boolean;
  onClose: () => void;
  speakers: SpeakerOption[];
  linkedIds: string[];
  onLink: (id: string) => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const available = speakers.filter(
    (s) => !linkedIds.includes(s.id) && s.name.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <Modal open={open} onClose={onClose} className="max-w-md max-h-[70vh] flex flex-col">
      <div className="px-5 py-4 border-b border-border shrink-0">
        <h2 className="text-lg font-semibold font-[family-name:var(--font-display)] mb-3">
          Add Speaker to Event
        </h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search speakers..."
            className={cn(INPUT_CLASS, "pl-9")}
            autoFocus
          />
        </div>
      </div>
      <div className="overflow-y-auto flex-1 py-1">
        {available.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted">
            {speakers.length === 0
              ? "No speakers in directory yet. Add some first."
              : query
                ? "No matching speakers found."
                : "All speakers are already linked."}
          </p>
        ) : (
          available.map((s) => (
            <button
              key={s.id}
              onClick={async () => {
                await onLink(s.id);
                onClose();
              }}
              className="flex items-center gap-3 w-full px-5 py-3 text-left hover:bg-surface-hover transition-colors cursor-pointer"
            >
              <OwnerAvatar name={s.name} size="md" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{s.name}</p>
                <p className="text-xs text-muted truncate">
                  {s.topic ?? s.email ?? "—"}
                </p>
              </div>
              <Plus className="h-4 w-4 text-muted shrink-0" />
            </button>
          ))
        )}
      </div>
    </Modal>
  );
}

function VenuePartnerPicker({
  open,
  onClose,
  venues,
  linkedIds,
  onLink,
}: {
  open: boolean;
  onClose: () => void;
  venues: VenuePartnerOption[];
  linkedIds: string[];
  onLink: (id: string) => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const available = venues.filter(
    (v) => !linkedIds.includes(v.id) && v.name.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <Modal open={open} onClose={onClose} className="max-w-md max-h-[70vh] flex flex-col">
      <div className="px-5 py-4 border-b border-border shrink-0">
        <h2 className="text-lg font-semibold font-[family-name:var(--font-display)] mb-3">
          Add Venue Partner to Event
        </h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search venue partners..."
            className={cn(INPUT_CLASS, "pl-9")}
            autoFocus
          />
        </div>
      </div>
      <div className="overflow-y-auto flex-1 py-1">
        {available.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted">
            {venues.length === 0
              ? "No venue partners in directory yet. Add some first."
              : query
                ? "No matching venue partners found."
                : "All venue partners are already linked."}
          </p>
        ) : (
          available.map((v) => (
            <button
              key={v.id}
              onClick={async () => {
                await onLink(v.id);
                onClose();
              }}
              className="flex items-center gap-3 w-full px-5 py-3 text-left hover:bg-surface-hover transition-colors cursor-pointer"
            >
              <div className="h-8 w-8 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                <Building2 className="h-4 w-4 text-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{v.name}</p>
                <p className="text-xs text-muted truncate">
                  {v.address ?? v.email ?? "—"}
                  {v.capacity ? ` · Cap: ${v.capacity}` : ""}
                </p>
              </div>
              <Plus className="h-4 w-4 text-muted shrink-0" />
            </button>
          ))
        )}
      </div>
    </Modal>
  );
}

const VENUE_STATUSES = ["INQUIRY", "PENDING", "CONFIRMED", "DECLINED", "CANCELLED"] as const;

type VenuePartnerItem = EventDetail["venuePartners"][number];

function VenuePartnerList({
  venuePartners,
  canEdit,
  canConfirmVenue,
  canSendVenueRequest,
  venueStatusUpdating,
  onStatusChange,
  onUnlink,
  onOpenVenueRequest,
}: {
  venuePartners: VenuePartnerItem[];
  canEdit: boolean;
  canConfirmVenue: boolean;
  canSendVenueRequest: boolean;
  venueStatusUpdating: string | null;
  onStatusChange: (linkId: string, status: string) => void;
  onUnlink: (venuePartnerId: string) => void;
  onOpenVenueRequest: (venueLink: VenuePartnerItem) => void;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggle = (id: string) =>
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="space-y-3">
      {venuePartners.map((evp) => {
        const isConfirmed = evp.status === "CONFIRMED";
        const isOpen = !!expanded[evp.id];

        return (
          <div
            key={evp.id}
            className={cn(
              "bg-surface border rounded-xl overflow-hidden transition-colors",
              isConfirmed
                ? "border-status-done/40 ring-1 ring-status-done/20"
                : "border-border"
            )}
          >
            <div className="flex items-center gap-4 px-5 py-4 group">
              <button
                onClick={() => toggle(evp.id)}
                className={cn(
                  "h-10 w-10 rounded-lg flex items-center justify-center shrink-0 cursor-pointer transition-colors",
                  isConfirmed ? "bg-status-done/15 hover:bg-status-done/25" : "bg-accent/10 hover:bg-accent/20"
                )}
                title={isOpen ? "Collapse details" : "Expand details"}
              >
                {isConfirmed ? (
                  <Check className="h-5 w-5 text-status-done" />
                ) : (
                  <Building2 className="h-5 w-5 text-accent" />
                )}
              </button>
              <div
                className="flex-1 min-w-0 cursor-pointer"
                onClick={() => toggle(evp.id)}
              >
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{evp.venuePartner.name}</p>
                  {isConfirmed && (
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-status-done">
                      Confirmed Venue
                    </span>
                  )}
                  {evp.venueRequestSent && (
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-accent">
                      Request Sent
                    </span>
                  )}
                  <ChevronDown
                    className={cn(
                      "h-3.5 w-3.5 text-muted transition-transform duration-200",
                      isOpen && "rotate-180"
                    )}
                  />
                </div>
                <div className="flex items-center gap-3 text-xs text-muted mt-0.5">
                  {evp.venuePartner.address && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {evp.venuePartner.address}
                    </span>
                  )}
                  {evp.venuePartner.capacity && (
                    <span>Cap: {evp.venuePartner.capacity}</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {canEdit ? (
                  <select
                    value={evp.status}
                    onChange={(e) => onStatusChange(evp.id, e.target.value)}
                    disabled={venueStatusUpdating === evp.id}
                    className="bg-background border border-border rounded-lg px-2 py-1 text-xs outline-none focus:border-accent cursor-pointer"
                  >
                    {VENUE_STATUSES.map((s) => (
                      <option
                        key={s}
                        value={s}
                        disabled={s === "CONFIRMED" && !canConfirmVenue}
                      >
                        {s.charAt(0) + s.slice(1).toLowerCase()}
                      </option>
                    ))}
                  </select>
                ) : (
                  <StatusBadge type="venue" status={evp.status} />
                )}

                <PriorityBadge priority={evp.priority as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"} />

                {canEdit && (
                  <button
                    onClick={() => onUnlink(evp.venuePartner.id)}
                    className="p-1.5 rounded-lg text-muted hover:text-status-blocked hover:bg-status-blocked/10 transition-colors opacity-0 group-hover:opacity-100"
                    title="Remove venue partner"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Expandable details panel */}
            {isOpen && (
              <div className="px-5 py-3 border-t border-border bg-surface-hover/30 animate-fade-in">
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  {evp.venuePartner.contactName && (
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-muted font-medium">Contact Person</p>
                      <p className="text-foreground">{evp.venuePartner.contactName}</p>
                    </div>
                  )}
                  {evp.venuePartner.email && (
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-muted font-medium">Email</p>
                      <p className="text-foreground">{evp.venuePartner.email}</p>
                    </div>
                  )}
                  {evp.venuePartner.phone && (
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-muted font-medium">Phone</p>
                      <p className="text-foreground">{evp.venuePartner.phone}</p>
                    </div>
                  )}
                  {evp.venuePartner.address && (
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-muted font-medium">Address</p>
                      <p className="text-foreground">{evp.venuePartner.address}</p>
                    </div>
                  )}
                  {evp.venuePartner.capacity && (
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-muted font-medium">Capacity</p>
                      <p className="text-foreground">{evp.venuePartner.capacity}</p>
                    </div>
                  )}
                  {evp.cost && (
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-muted font-medium">Cost</p>
                      <p className="text-foreground">${evp.cost}</p>
                    </div>
                  )}
                  {evp.confirmationDate && (
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-muted font-medium">Confirmation Date</p>
                      <p className="text-foreground">{new Date(evp.confirmationDate).toLocaleDateString()}</p>
                    </div>
                  )}
                  {evp.notes && (
                    <div className="col-span-2">
                      <p className="text-[11px] uppercase tracking-wide text-muted font-medium">Notes</p>
                      <p className="text-foreground">{evp.notes}</p>
                    </div>
                  )}
                  {canSendVenueRequest && (
                    <div className="col-span-2 pt-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => onOpenVenueRequest(evp)}
                        disabled={!evp.venuePartner.email || evp.venueRequestSent}
                        title={
                          evp.venueRequestSent
                            ? "A venue request has already been sent for this event"
                            : evp.venuePartner.email
                              ? "Compose venue request email"
                              : "Venue partner has no email"
                        }
                      >
                        <Mail className="h-3.5 w-3.5" />
                        {evp.venueRequestSent ? "Request Already Sent" : "Compose Venue Request"}
                      </Button>
                      {evp.venueRequestSentAt && (
                        <div className="mt-1.5 flex items-center gap-2">
                          <p className="text-xs text-muted">
                            Sent on {new Date(evp.venueRequestSentAt).toLocaleString()}
                          </p>
                          {evp.venueRequestGmailUrl && (
                            <a
                              href={evp.venueRequestGmailUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-accent hover:underline"
                            >
                              Open in Gmail
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function TaskRow({
  task,
  checklistId,
  eventVolunteers,
  onUpdate,
  readOnly,
  volunteerMode,
  currentVolunteerId,
}: {
  task: TaskItem;
  checklistId: string;
  eventVolunteers: EventVolunteerItem[];
  onUpdate: (checklistId: string, taskId: string, data: Record<string, unknown>) => Promise<void>;
  readOnly?: boolean;
  volunteerMode?: boolean;
  currentVolunteerId?: string | null;
}) {
  const [showAssignee, setShowAssignee] = useState(false);
  const [editingDeadline, setEditingDeadline] = useState(false);
  const [deadlineValue, setDeadlineValue] = useState(
    task.deadline ? task.deadline.slice(0, 10) : ""
  );

  const canToggleDone = !readOnly;
  const canEditDeadline = !readOnly && !volunteerMode;

  const toggleDone = () => {
    if (!canToggleDone) return;
    onUpdate(checklistId, task.id, {
      status: task.status === "DONE" ? "TODO" : "DONE",
    });
  };

  const assignVolunteer = (volunteerId: string | null) => {
    onUpdate(checklistId, task.id, { volunteerAssigneeId: volunteerId });
    setShowAssignee(false);
  };

  const saveDeadline = () => {
    onUpdate(checklistId, task.id, {
      deadline: deadlineValue || null,
    });
    setEditingDeadline(false);
  };

  const isOverdue =
    task.deadline &&
    task.status !== "DONE" &&
    new Date(task.deadline) < new Date();

  const currentAssignee = task.volunteerAssignee ?? task.assignee;
  const currentVolAssigneeId = task.volunteerAssignee?.id;
  const isSelfAssigned = volunteerMode && currentVolAssigneeId === currentVolunteerId;
  const isAssignedToOther = !!currentAssignee && !isSelfAssigned;
  const isUnassigned = !currentAssignee;

  return (
    <div className="flex items-center gap-3 px-5 py-3 border-b border-border last:border-0 hover:bg-surface-hover/50 transition-colors group">
      <button
        onClick={toggleDone}
        disabled={!canToggleDone}
        className={cn(
          "h-5 w-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors",
          !canToggleDone ? "cursor-default" : "cursor-pointer",
          task.status === "DONE"
            ? "bg-status-done border-status-done"
            : "border-border hover:border-accent"
        )}
      >
        {task.status === "DONE" && <Check className="h-3 w-3 text-white" />}
      </button>

      <span
        className={cn(
          "text-sm flex-1 min-w-0 truncate",
          task.status === "DONE" && "line-through text-muted"
        )}
      >
        {task.title}
      </span>

      {/* Full assignment dropdown for EVENT_LEAD+ */}
      {!readOnly && !volunteerMode && (
        <div className="relative shrink-0">
          <button
            onClick={() => setShowAssignee(!showAssignee)}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs transition-colors cursor-pointer",
              currentAssignee
                ? "bg-surface-hover text-foreground"
                : "text-muted hover:bg-surface-hover hover:text-foreground opacity-0 group-hover:opacity-100"
            )}
            title={currentAssignee ? `Assigned to ${currentAssignee.name}` : "Assign volunteer"}
          >
            {currentAssignee ? (
              <>
                <OwnerAvatar name={currentAssignee.name} size="sm" />
                <span className="max-w-[80px] truncate">{currentAssignee.name}</span>
              </>
            ) : (
              <>
                <UserPlus className="h-3.5 w-3.5" />
                <span>Assign</span>
              </>
            )}
          </button>

          {showAssignee && (
            <div className="absolute top-full right-0 mt-1 z-30 w-52 bg-surface border border-border rounded-lg shadow-xl py-1 animate-fade-in">
              {currentAssignee && (
                <button
                  onClick={() => assignVolunteer(null)}
                  className="flex items-center gap-2 w-full px-3 py-2 text-xs text-status-blocked hover:bg-surface-hover transition-colors cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                  Unassign
                </button>
              )}
              {eventVolunteers.length === 0 ? (
                <p className="px-3 py-2 text-xs text-muted">
                  No volunteers linked. Add some in the Volunteers tab.
                </p>
              ) : (
                eventVolunteers.map((ev) => (
                  <button
                    key={ev.volunteer.id}
                    onClick={() => assignVolunteer(ev.volunteer.id)}
                    className={cn(
                      "flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-surface-hover transition-colors cursor-pointer",
                      currentVolAssigneeId === ev.volunteer.id && "bg-accent/10 text-accent"
                    )}
                  >
                    <OwnerAvatar name={ev.volunteer.name} size="sm" />
                    <span className="truncate">{ev.volunteer.name}</span>
                    {ev.assignedRole && (
                      <span className="ml-auto text-[10px] text-muted">{ev.assignedRole}</span>
                    )}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* Volunteer self-assign mode */}
      {volunteerMode && (
        <div className="shrink-0">
          {isSelfAssigned ? (
            <button
              onClick={() => assignVolunteer(null)}
              className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs bg-accent/10 text-accent transition-colors cursor-pointer hover:bg-accent/20"
              title="Unassign yourself"
            >
              <OwnerAvatar name={currentAssignee!.name} size="sm" />
              <span>You</span>
              <X className="h-3 w-3 ml-0.5" />
            </button>
          ) : isUnassigned ? (
            <button
              onClick={() => currentVolunteerId && assignVolunteer(currentVolunteerId)}
              className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-muted hover:bg-surface-hover hover:text-foreground transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
              title="Assign to yourself"
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span>Take</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-muted">
              <OwnerAvatar name={currentAssignee!.name} size="sm" />
              <span className="max-w-[80px] truncate">{currentAssignee!.name}</span>
            </div>
          )}
        </div>
      )}

      {/* Read-only assignee display for VIEWERs */}
      {readOnly && currentAssignee && (
        <div className="flex items-center gap-1.5 text-xs text-muted shrink-0">
          <OwnerAvatar name={currentAssignee.name} size="sm" />
          <span className="max-w-[80px] truncate">{currentAssignee.name}</span>
        </div>
      )}

      <PriorityBadge priority={task.priority as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"} />
      <StatusBadge type="task" status={task.status} />

      <div className="shrink-0 w-28 text-right">
        {canEditDeadline && editingDeadline ? (
          <div className="flex items-center gap-1">
            <input
              type="date"
              value={deadlineValue}
              onChange={(e) => setDeadlineValue(e.target.value)}
              onBlur={saveDeadline}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveDeadline();
                if (e.key === "Escape") setEditingDeadline(false);
              }}
              autoFocus
              className="w-full bg-background border border-border rounded px-1.5 py-0.5 text-[11px] font-[family-name:var(--font-mono)] outline-none focus:border-accent"
            />
          </div>
        ) : (
          <button
            onClick={() => {
              if (!canEditDeadline) return;
              setDeadlineValue(task.deadline ? task.deadline.slice(0, 10) : "");
              setEditingDeadline(true);
            }}
            disabled={!canEditDeadline}
            className={cn(
              "text-[11px] font-[family-name:var(--font-mono)] transition-colors rounded px-1.5 py-0.5",
              !canEditDeadline ? "cursor-default" : "cursor-pointer",
              task.deadline
                ? isOverdue
                  ? "text-status-blocked bg-status-blocked/10"
                  : "text-muted hover:bg-surface-hover"
                : !canEditDeadline
                  ? "text-muted/40"
                  : "text-muted/40 hover:bg-surface-hover hover:text-muted opacity-0 group-hover:opacity-100"
            )}
            title={!canEditDeadline ? undefined : "Click to edit deadline"}
          >
            {task.deadline ? (
              <>
                <CalendarDays className="h-3 w-3 inline mr-1" />
                {formatDate(task.deadline)}
              </>
            ) : canEditDeadline ? (
              <>
                <CalendarDays className="h-3 w-3 inline mr-1" />
                Set date
              </>
            ) : null}
          </button>
        )}
      </div>
    </div>
  );
}

const CHECKLIST_COLORS: Record<string, { accent: string; bg: string; border: string; dot: string }> = {
  "Pre-Event":  { accent: "text-blue-400",    bg: "bg-blue-400/10",    border: "border-blue-400/20",  dot: "bg-blue-400" },
  "On-Day":     { accent: "text-amber-400",   bg: "bg-amber-400/10",   border: "border-amber-400/20", dot: "bg-amber-400" },
  "Post-Event": { accent: "text-emerald-400", bg: "bg-emerald-400/10", border: "border-emerald-400/20", dot: "bg-emerald-400" },
};

function parseChecklistSection(title: string): { section: string; subcategory: string } | null {
  const match = title.match(/^(Pre-Event|On-Day|Post-Event):\s*(.+)$/);
  if (match) return { section: match[1], subcategory: match[2] };
  // Legacy support: titles without subcategory
  if (title in CHECKLIST_COLORS) return { section: title, subcategory: "" };
  return null;
}

type TemplateOption = { id: string; name: string; description: string | null };

function ChecklistTab({
  checklists,
  eventVolunteers,
  onUpdateTask,
  readOnly,
  volunteerMode,
  currentVolunteerId,
  isAdmin,
  eventId,
  onTemplateChanged,
}: {
  checklists: EventDetail["checklists"];
  eventVolunteers: EventVolunteerItem[];
  onUpdateTask: (checklistId: string, taskId: string, data: Record<string, unknown>) => Promise<void>;
  readOnly?: boolean;
  volunteerMode?: boolean;
  currentVolunteerId?: string | null;
  isAdmin?: boolean;
  eventId: string;
  onTemplateChanged?: () => void;
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const allCollapsed = checklists.length > 0 && checklists.every((c) => collapsed[c.id]);

  // Template change state
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [changingTemplate, setChangingTemplate] = useState(false);

  const openTemplatePicker = async () => {
    setTemplatePickerOpen(true);
    setLoadingTemplates(true);
    try {
      const res = await fetch("/api/templates");
      if (res.ok) setTemplates(await res.json());
    } finally {
      setLoadingTemplates(false);
    }
  };

  const handleSelectTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    setTemplatePickerOpen(false);
    setConfirmOpen(true);
  };

  const handleConfirmChange = async () => {
    if (!selectedTemplateId) return;
    setChangingTemplate(true);
    try {
      const res = await fetch(`/api/events/${eventId}/change-template`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId: selectedTemplateId }),
      });
      if (res.ok) {
        onTemplateChanged?.();
      }
    } finally {
      setChangingTemplate(false);
      setConfirmOpen(false);
      setSelectedTemplateId(null);
    }
  };

  const toggleAll = () => {
    const next: Record<string, boolean> = {};
    for (const c of checklists) next[c.id] = !allCollapsed;
    setCollapsed(next);
  };

  const toggle = (id: string) =>
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));

  if (checklists.length === 0) {
    return (
      <EmptyState
        icon={ClipboardCheck}
        title="No checklists yet"
        description="Create a checklist or apply an SOP template to track tasks."
      />
    );
  }

  // Group checklists by section (Pre-Event, On-Day, Post-Event)
  const sectionOrder = ["Pre-Event", "On-Day", "Post-Event"];
  const sectionGroups: { section: string; checklists: EventDetail["checklists"] }[] = [];
  const ungrouped: EventDetail["checklists"] = [];

  // Build section groups maintaining order
  const sectionMap = new Map<string, EventDetail["checklists"]>();
  for (const cl of checklists) {
    const parsed = parseChecklistSection(cl.title);
    if (parsed) {
      const sec = parsed.section;
      if (!sectionMap.has(sec)) sectionMap.set(sec, []);
      sectionMap.get(sec)!.push(cl);
    } else {
      // Legacy or manually created checklists
      ungrouped.push(cl);
    }
  }

  for (const sec of sectionOrder) {
    if (sectionMap.has(sec)) {
      sectionGroups.push({ section: sec, checklists: sectionMap.get(sec)! });
    }
  }

  const hasSubcategories = sectionGroups.length > 0;

  const selectedTemplateName = templates.find((t) => t.id === selectedTemplateId)?.name;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="relative group">
          <button
            onClick={isAdmin ? openTemplatePicker : undefined}
            disabled={!isAdmin}
            className={cn(
              "inline-flex items-center gap-1.5 text-xs rounded-lg px-3 py-1.5 border transition-colors",
              isAdmin
                ? "text-muted hover:text-foreground hover:border-accent/40 border-border cursor-pointer"
                : "text-muted/40 border-border/50 cursor-not-allowed"
            )}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Change SOP Template
          </button>
          {!isAdmin && (
            <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block z-10 w-52">
              <div className="bg-surface border border-border rounded-lg px-3 py-2 text-[11px] text-muted shadow-lg">
                Only admins can change the SOP template.
              </div>
            </div>
          )}
        </div>
        <button
          onClick={toggleAll}
          className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-foreground transition-colors cursor-pointer"
        >
          <ChevronsUpDown className="h-3.5 w-3.5" />
          {allCollapsed ? "Expand All" : "Collapse All"}
        </button>
      </div>

      {/* Template Picker Modal */}
      <Modal open={templatePickerOpen} onClose={() => setTemplatePickerOpen(false)} className="p-6 max-w-md">
        <h2 className="text-lg font-semibold font-[family-name:var(--font-display)] mb-1">Change SOP Template</h2>
        <p className="text-sm text-muted mb-4">
          Select a new template to apply to this event.
        </p>
        {loadingTemplates ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 rounded-lg animate-shimmer" />
            ))}
          </div>
        ) : templates.length === 0 ? (
          <p className="text-sm text-muted text-center py-6">No templates available.</p>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {templates.map((t) => (
              <button
                key={t.id}
                onClick={() => handleSelectTemplate(t.id)}
                className="w-full text-left px-4 py-3 rounded-lg border border-border hover:border-accent/40 hover:bg-surface-hover/50 transition-colors cursor-pointer"
              >
                <div className="text-sm font-medium">{t.name}</div>
                {t.description && (
                  <div className="text-xs text-muted mt-0.5 line-clamp-1">{t.description}</div>
                )}
              </button>
            ))}
          </div>
        )}
        <div className="flex justify-end mt-4">
          <Button variant="secondary" size="sm" onClick={() => setTemplatePickerOpen(false)}>
            Cancel
          </Button>
        </div>
      </Modal>

      {/* Confirmation Warning Modal */}
      <Modal open={confirmOpen} onClose={() => { setConfirmOpen(false); setSelectedTemplateId(null); }} className="p-6 max-w-md">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-9 w-9 rounded-full bg-status-error/10 flex items-center justify-center">
            <AlertTriangle className="h-5 w-5 text-status-error" />
          </div>
          <h2 className="text-lg font-semibold font-[family-name:var(--font-display)]">
            Reset All Checklist Progress?
          </h2>
        </div>
        <div className="space-y-2 mb-5">
          <p className="text-sm text-muted">
            Changing the SOP template to <span className="font-medium text-foreground">&quot;{selectedTemplateName}&quot;</span> will:
          </p>
          <ul className="text-sm text-muted space-y-1.5 ml-4">
            <li className="flex items-start gap-2">
              <span className="text-status-error mt-0.5">•</span>
              <span>Delete <strong className="text-foreground">all existing checklists</strong> and their tasks</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-status-error mt-0.5">•</span>
              <span>Remove all task assignments, deadlines, and progress</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-status-error mt-0.5">•</span>
              <span>Create fresh checklists from the selected template</span>
            </li>
          </ul>
          <p className="text-sm font-medium text-status-error">
            This action cannot be undone.
          </p>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={() => { setConfirmOpen(false); setSelectedTemplateId(null); }}>
            Cancel
          </Button>
          <Button variant="danger" size="sm" disabled={changingTemplate} onClick={handleConfirmChange}>
            {changingTemplate ? "Applying..." : "Yes, Reset & Apply"}
          </Button>
        </div>
      </Modal>

      <div className="space-y-6">
        {hasSubcategories ? (
          <>
            {sectionGroups.map(({ section, checklists: sectionChecklists }) => {
              const sectionColors = CHECKLIST_COLORS[section];
              const sectionDone = sectionChecklists.reduce((sum, c) => sum + c.tasks.filter((t) => t.status === "DONE").length, 0);
              const sectionTotal = sectionChecklists.reduce((sum, c) => sum + c.tasks.length, 0);
              const sectionPct = sectionTotal > 0 ? Math.round((sectionDone / sectionTotal) * 100) : 0;

              return (
                <div key={section}>
                  {/* Section header */}
                  <div className="flex items-center gap-3 mb-3">
                    {sectionColors && (
                      <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", sectionColors.dot)} />
                    )}
                    <h3 className={cn(
                      "text-base font-bold font-[family-name:var(--font-display)]",
                      sectionColors?.accent ?? "text-foreground"
                    )}>
                      {section}
                    </h3>
                    <div className="flex items-center gap-2 ml-auto">
                      <div className="w-20 h-1.5 rounded-full bg-surface-active overflow-hidden hidden sm:block">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-500",
                            sectionColors ? sectionColors.dot : "bg-accent"
                          )}
                          style={{ width: `${sectionPct}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-[family-name:var(--font-mono)] text-muted">
                        {sectionDone}/{sectionTotal}
                      </span>
                    </div>
                  </div>

                  {/* Subcategory checklists */}
                  <div className="space-y-3 pl-0 sm:pl-5">
                    {sectionChecklists.map((checklist) => {
                      const parsed = parseChecklistSection(checklist.title);
                      const subcategoryLabel = parsed?.subcategory || checklist.title;
                      const isCollapsed = !!collapsed[checklist.id];
                      const done = checklist.tasks.filter((t) => t.status === "DONE").length;
                      const total = checklist.tasks.length;
                      const pct = total > 0 ? Math.round((done / total) * 100) : 0;

                      return (
                        <div
                          key={checklist.id}
                          className="bg-surface border border-border rounded-xl"
                        >
                          <button
                            onClick={() => toggle(checklist.id)}
                            className="w-full px-5 py-3 flex items-center gap-3 cursor-pointer hover:bg-surface-hover/50 transition-colors"
                          >
                            <h4 className="text-sm font-semibold font-[family-name:var(--font-display)] text-foreground">
                              {subcategoryLabel}
                            </h4>

                            <div className="flex items-center gap-2 ml-auto">
                              <div className="w-16 h-1.5 rounded-full bg-surface-active overflow-hidden hidden sm:block">
                                <div
                                  className={cn(
                                    "h-full rounded-full transition-all duration-500",
                                    sectionColors ? sectionColors.dot : "bg-accent"
                                  )}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className="text-[11px] font-[family-name:var(--font-mono)] text-muted">
                                {done}/{total}
                              </span>
                              <ChevronDown
                                className={cn(
                                  "h-4 w-4 text-muted transition-transform duration-200",
                                  isCollapsed && "-rotate-90"
                                )}
                              />
                            </div>
                          </button>

                          {!isCollapsed && (
                            <div className={cn("border-t", sectionColors?.border ?? "border-border")}>
                              {checklist.tasks.map((task) => (
                                <TaskRow
                                  key={task.id}
                                  task={task}
                                  checklistId={checklist.id}
                                  eventVolunteers={eventVolunteers}
                                  onUpdate={onUpdateTask}
                                  readOnly={readOnly}
                                  volunteerMode={volunteerMode}
                                  currentVolunteerId={currentVolunteerId}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Ungrouped / legacy checklists */}
            {ungrouped.length > 0 && (
              <div className="space-y-4">
                {ungrouped.map((checklist) => {
                  const colors = CHECKLIST_COLORS[checklist.title];
                  const isCollapsed = !!collapsed[checklist.id];
                  const done = checklist.tasks.filter((t) => t.status === "DONE").length;
                  const total = checklist.tasks.length;
                  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

                  return (
                    <div
                      key={checklist.id}
                      className="bg-surface border border-border rounded-xl"
                    >
                      <button
                        onClick={() => toggle(checklist.id)}
                        className="w-full px-5 py-3 flex items-center gap-3 cursor-pointer hover:bg-surface-hover/50 transition-colors"
                      >
                        {colors && (
                          <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", colors.dot)} />
                        )}
                        <h4
                          className={cn(
                            "text-sm font-semibold font-[family-name:var(--font-display)]",
                            colors?.accent ?? "text-foreground"
                          )}
                        >
                          {checklist.title}
                        </h4>

                        <div className="flex items-center gap-2 ml-auto">
                          <div className="w-16 h-1.5 rounded-full bg-surface-active overflow-hidden hidden sm:block">
                            <div
                              className={cn(
                                "h-full rounded-full transition-all duration-500",
                                colors ? colors.dot : "bg-accent"
                              )}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-[11px] font-[family-name:var(--font-mono)] text-muted">
                            {done}/{total}
                          </span>
                          <ChevronDown
                            className={cn(
                              "h-4 w-4 text-muted transition-transform duration-200",
                              isCollapsed && "-rotate-90"
                            )}
                          />
                        </div>
                      </button>

                      {!isCollapsed && (
                        <div className={cn("border-t", colors?.border ?? "border-border")}>
                          {checklist.tasks.map((task) => (
                            <TaskRow
                              key={task.id}
                              task={task}
                              checklistId={checklist.id}
                              eventVolunteers={eventVolunteers}
                              onUpdate={onUpdateTask}
                              readOnly={readOnly}
                              volunteerMode={volunteerMode}
                              currentVolunteerId={currentVolunteerId}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          /* Legacy layout: flat checklists without section grouping */
          <div className="space-y-4">
            {checklists.map((checklist) => {
              const colors = CHECKLIST_COLORS[checklist.title];
              const isCollapsed = !!collapsed[checklist.id];
              const done = checklist.tasks.filter((t) => t.status === "DONE").length;
              const total = checklist.tasks.length;
              const pct = total > 0 ? Math.round((done / total) * 100) : 0;

              return (
                <div
                  key={checklist.id}
                  className="bg-surface border border-border rounded-xl"
                >
                  <button
                    onClick={() => toggle(checklist.id)}
                    className="w-full px-5 py-3 flex items-center gap-3 cursor-pointer hover:bg-surface-hover/50 transition-colors"
                  >
                    {colors && (
                      <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", colors.dot)} />
                    )}
                    <h4
                      className={cn(
                        "text-sm font-semibold font-[family-name:var(--font-display)]",
                        colors?.accent ?? "text-foreground"
                      )}
                    >
                      {checklist.title}
                    </h4>

                    <div className="flex items-center gap-2 ml-auto">
                      <div className="w-16 h-1.5 rounded-full bg-surface-active overflow-hidden hidden sm:block">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-500",
                            colors ? colors.dot : "bg-accent"
                          )}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-[family-name:var(--font-mono)] text-muted">
                        {done}/{total}
                      </span>
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 text-muted transition-transform duration-200",
                          isCollapsed && "-rotate-90"
                        )}
                      />
                    </div>
                  </button>

                  {!isCollapsed && (
                    <div className={cn("border-t", colors?.border ?? "border-border")}>
                      {checklist.tasks.map((task) => (
                        <TaskRow
                          key={task.id}
                          task={task}
                          checklistId={checklist.id}
                          eventVolunteers={eventVolunteers}
                          onUpdate={onUpdateTask}
                          readOnly={readOnly}
                          volunteerMode={volunteerMode}
                          currentVolunteerId={currentVolunteerId}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

type Tab = "overview" | "speakers" | "volunteers" | "venues" | "checklist";

const TABS: { id: Tab; label: string; icon: typeof Calendar }[] = [
  { id: "overview", label: "Overview", icon: Calendar },
  { id: "speakers", label: "Speakers", icon: Mic2 },
  { id: "volunteers", label: "Volunteers", icon: Users },
  { id: "venues", label: "Venue Partners", icon: Building2 },
  { id: "checklist", label: "SOP Checklist", icon: ClipboardCheck },
];

const ROLE_LEVEL: Record<string, number> = {
  VIEWER: 0, VOLUNTEER: 1, EVENT_LEAD: 2, ADMIN: 3, SUPER_ADMIN: 4,
};

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: session } = useSession();
  const { meetupName, meetupDescription, minVolunteerTasks } = useAppSettings();
  const userRole = session?.user?.globalRole ?? "VIEWER";
  const canEdit = (ROLE_LEVEL[userRole] ?? 0) >= ROLE_LEVEL.EVENT_LEAD;
  const isAdmin = (ROLE_LEVEL[userRole] ?? 0) >= ROLE_LEVEL.ADMIN;
  const isSuperAdmin = userRole === "SUPER_ADMIN";
  const isVolunteer = userRole === "VOLUNTEER";
  const isReadOnly = userRole === "VIEWER";

  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  const fetchEvent = useCallback(() => {
    fetch(`/api/events/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setEvent)
      .catch(() => setEvent(null))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    fetchEvent();
  }, [fetchEvent]);

  // Check if user can delete this specific event
  // Only: 1) Super Admin (any event), or 2) Event creator if they are Admin/Super Admin
  const canDelete = event && (isSuperAdmin || (event.createdBy.id === session?.user?.id && (isAdmin || isSuperAdmin)));

  const updateTask = async (
    checklistId: string,
    taskId: string,
    data: Record<string, unknown>
  ) => {
    // SOP venue confirmation validation
    if (data.status === "DONE" && event) {
      const task = event.checklists
        .flatMap((c) => c.tasks)
        .find((t) => t.id === taskId);

      if (task) {
        const titleLower = task.title.toLowerCase();
        const isVenueTask = titleLower.includes("venue") && titleLower.includes("confirm");

        if (isVenueTask) {
          const hasConfirmedVenue = event.venuePartners.some((vp) => vp.status === "CONFIRMED");
          if (!hasConfirmedVenue) {
            setSopBlockModal(true);
            return;
          }
        }
      }
    }

    const res = await fetch(`/api/checklists/${checklistId}/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) fetchEvent();
  };

  // --- Volunteer & Speaker linking ---
  const [volPickerOpen, setVolPickerOpen] = useState(false);
  const [spkPickerOpen, setSpkPickerOpen] = useState(false);
  const [venuePickerOpen, setVenuePickerOpen] = useState(false);
  const [allVolunteers, setAllVolunteers] = useState<VolunteerOption[]>([]);
  const [allMembers, setAllMembers] = useState<MemberOption[]>([]);
  const [allSpeakers, setAllSpeakers] = useState<SpeakerOption[]>([]);
  const [allVenuePartners, setAllVenuePartners] = useState<VenuePartnerOption[]>([]);
  const [venueConfirmModal, setVenueConfirmModal] = useState<{ linkId: string; existingName: string } | null>(null);
  const [venueStatusUpdating, setVenueStatusUpdating] = useState<string | null>(null);
  const [sopBlockModal, setSopBlockModal] = useState(false);
  const [venueRequestModal, setVenueRequestModal] = useState<{
    linkId: string;
    venueName: string;
    venueEmail: string;
  } | null>(null);
  const [venueRequestSubject, setVenueRequestSubject] = useState("");
  const [venueRequestBody, setVenueRequestBody] = useState("");
  const [venueRequestSending, setVenueRequestSending] = useState(false);
  const [venueRequestError, setVenueRequestError] = useState<string | null>(null);
  const [venueRequestSuccess, setVenueRequestSuccess] = useState<string | null>(null);

  const loadVolunteersAndMembers = useCallback(async () => {
    const [volRes, memRes] = await Promise.all([
      fetch("/api/volunteers"),
      fetch("/api/members/list"),
    ]);
    if (volRes.ok) setAllVolunteers(await volRes.json());
    if (memRes.ok) setAllMembers(await memRes.json());
  }, []);

  const loadSpeakers = useCallback(async () => {
    const res = await fetch("/api/speakers");
    if (res.ok) setAllSpeakers(await res.json());
  }, []);

  const loadVenuePartners = useCallback(async () => {
    const res = await fetch("/api/venues");
    if (res.ok) setAllVenuePartners(await res.json());
  }, []);

  const linkVolunteer = async (volunteerId: string) => {
    await fetch(`/api/events/${id}/volunteers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ volunteerId }),
    });
    fetchEvent();
  };

  const linkMember = async (userId: string) => {
    await fetch(`/api/events/${id}/volunteers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    fetchEvent();
  };

  const unlinkVolunteer = async (volunteerId: string) => {
    await fetch(`/api/events/${id}/volunteers?volunteerId=${volunteerId}`, {
      method: "DELETE",
    });
    fetchEvent();
  };

  const linkSpeaker = async (speakerId: string) => {
    await fetch(`/api/events/${id}/speakers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ speakerId }),
    });
    fetchEvent();
  };

  const unlinkSpeaker = async (speakerId: string) => {
    await fetch(`/api/events/${id}/speakers?speakerId=${speakerId}`, {
      method: "DELETE",
    });
    fetchEvent();
  };

  const linkVenuePartner = async (venuePartnerId: string) => {
    await fetch(`/api/events/${id}/venues`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ venuePartnerId }),
    });
    fetchEvent();
  };

  const unlinkVenuePartner = async (venuePartnerId: string) => {
    if (!confirm("Removing this venue partner will reset any venue confirmation SOP task. Continue?")) return;
    await fetch(`/api/events/${id}/venues?venuePartnerId=${venuePartnerId}`, {
      method: "DELETE",
    });
    fetchEvent();
  };

  const updateVenueLink = async (linkId: string, data: Record<string, unknown>, force = false) => {
    const url = `/api/events/${id}/venues/${linkId}${force ? "?force=true" : ""}`;
    const res = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (res.status === 409) {
      const conflict = await res.json();
      if (conflict.conflict) {
        setVenueConfirmModal({
          linkId,
          existingName: conflict.existingVenue.venuePartner.name,
        });
        return;
      }
    }

    if (res.ok) fetchEvent();
  };

  const openVenueRequestComposer = (venueLink: VenuePartnerItem) => {
    if (!event) return;
    if (!venueLink.venuePartner.email) {
      alert("This venue partner does not have an email address.");
      return;
    }
    if (venueLink.venueRequestSent) {
      alert("A venue request email was already sent for this event.");
      return;
    }

    const eventType = event.title.toLowerCase().includes("workshop")
      ? "Workshop"
      : event.title.toLowerCase().includes("hackathon")
        ? "Hackathon"
        : "Community Meetup";

    const requirementLines = [
      `- Capacity for ${venueLink.venuePartner.capacity ?? 80} attendees`,
      "- Projector / screen and audio support",
      "- Reliable Wi-Fi access",
      "- Seating arrangement for talks and networking",
    ];
    const emailMeetupName =
      meetupName.replace(/\s*manager\s*$/i, "").trim() || meetupName;

    const draft = [
      `Hi ${venueLink.venuePartner.contactName ?? "Team"},`,
      "",
      `I'm reaching out on behalf of ${emailMeetupName} to check if your venue can host our upcoming event.`,
      "",
      "Meetup Group",
      `${emailMeetupName}`,
      ...(meetupDescription ? [`- Description: ${meetupDescription}`] : []),
      "",
      "Event Type",
      `${eventType}`,
      "",
      "Event Details",
      `- Event: ${event.title}`,
      `- Date: ${formatDateTimeRange(event.date, event.endDate)}`,
      ...(event.description ? [`- Description: ${event.description}`] : []),
      "",
      "Event Requirements",
      ...requirementLines,
      "",
      "Please let us know your availability and any hosting terms.",
      "",
      "Thanks,",
      `${session?.user?.name ?? "Event Team"}`,
      `${emailMeetupName}`,
    ].join("\n");

    setVenueRequestSubject(`Venue request: ${event.title} by ${emailMeetupName}`);
    setVenueRequestBody(draft);
    setVenueRequestError(null);
    setVenueRequestSuccess(null);
    setVenueRequestModal({
      linkId: venueLink.id,
      venueName: venueLink.venuePartner.name,
      venueEmail: venueLink.venuePartner.email,
    });
  };

  const sendVenueRequestEmail = async () => {
    if (!venueRequestModal) return;
    if (!venueRequestSubject.trim() || !venueRequestBody.trim()) {
      setVenueRequestError("Subject and message are required.");
      return;
    }

    setVenueRequestSending(true);
    setVenueRequestError(null);
    setVenueRequestSuccess(null);
    try {
      const res = await fetch(`/api/events/${id}/venues/${venueRequestModal.linkId}/request-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: venueRequestSubject.trim(),
          message: venueRequestBody.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to send venue request email");
      }
      setVenueRequestSuccess(`Sent to ${venueRequestModal.venueEmail}`);
      fetchEvent();
      setTimeout(() => {
        setVenueRequestModal(null);
        setVenueRequestSuccess(null);
      }, 1200);
    } catch (e) {
      setVenueRequestError(e instanceof Error ? e.message : "Failed to send venue request email");
    } finally {
      setVenueRequestSending(false);
    }
  };

  const confirmVenueSwitch = async () => {
    if (!venueConfirmModal) return;
    setVenueStatusUpdating(venueConfirmModal.linkId);
    await updateVenueLink(venueConfirmModal.linkId, { status: "CONFIRMED" }, true);
    setVenueConfirmModal(null);
    setVenueStatusUpdating(null);
  };

  // --- Edit event ---
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    title: "",
    date: "",
    endDate: "",
    venue: "",
    description: "",
    pageLink: "",
  });
  const [editSaving, setEditSaving] = useState(false);
  const [dateValidationError, setDateValidationError] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="animate-fade-in space-y-4">
        <div className="h-8 w-64 rounded animate-shimmer" />
        <div className="h-4 w-96 rounded animate-shimmer" />
        <div className="h-64 rounded-xl animate-shimmer" />
      </div>
    );
  }

  if (!event) {
    return (
      <EmptyState
        icon={Calendar}
        title="Event not found"
        description="This event may have been deleted."
        action={
          <Link href="/events">
            <Button variant="secondary">Back to Events</Button>
          </Link>
        }
      />
    );
  }

  const allTasks = event.checklists.flatMap((c) => c.tasks);
  const doneTasks = allTasks.filter((t) => t.status === "DONE").length;
  const progress = allTasks.length > 0 ? Math.round((doneTasks / allTasks.length) * 100) : 0;

  const MIN_VOLUNTEER_TASKS = minVolunteerTasks;
  const volunteerTaskCounts = new Map<string, { completed: number; total: number }>();
  for (const task of allTasks) {
    if (task.volunteerAssignee) {
      const vid = task.volunteerAssignee.id;
      const entry = volunteerTaskCounts.get(vid) ?? { completed: 0, total: 0 };
      entry.total += 1;
      if (task.status === "DONE") entry.completed += 1;
      volunteerTaskCounts.set(vid, entry);
    }
  }

  const linkedMemberIds = event.volunteers
    .map((ev) => ev.volunteer.userId)
    .filter((uid): uid is string => uid != null);

  const myVolunteerEntry = isVolunteer
    ? event.volunteers.find((ev) => ev.volunteer.userId === session?.user?.id)
    : null;
  const myVolunteerId = myVolunteerEntry?.volunteer.id ?? null;

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this event?")) return;
    const res = await fetch(`/api/events/${id}`, { method: "DELETE" });
    if (res.ok) router.push("/events");
  };

  const openEdit = () => {
    setEditForm({
      title: event.title,
      date: event.date.slice(0, 16),
      endDate: event.endDate.slice(0, 16),
      venue: event.venue ?? "",
      description: event.description ?? "",
      pageLink: event.pageLink ?? "",
    });
    setDateValidationError(null);
    setEditOpen(true);
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.title.trim() || !editForm.date || !editForm.endDate) return;
    
    // Validate that end date is after start date
    const startDate = new Date(editForm.date);
    const endDate = new Date(editForm.endDate);
    if (endDate <= startDate) {
      setDateValidationError("End time must be greater than start time");
      return;
    }
    
    setDateValidationError(null);
    setEditSaving(true);
    const res = await fetch(`/api/events/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: editForm.title.trim(),
        date: editForm.date,
        endDate: editForm.endDate,
        venue: editForm.venue.trim() || null,
        description: editForm.description.trim() || null,
        pageLink: editForm.pageLink.trim() || null,
      }),
    });
    setEditSaving(false);
    if (res.ok) {
      setEditOpen(false);
      fetchEvent();
    }
  };

  return (
    <div className="animate-fade-in">
      <Link
        href="/events"
        className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-foreground transition-colors mb-4"
      >
        <ArrowLeft className="h-3 w-3" /> Events
      </Link>

      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold font-[family-name:var(--font-display)] tracking-tight">
              {event.title}
            </h1>
            {new Date(event.date) >= new Date(new Date().toDateString()) ? (
              <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium bg-status-progress/15 text-status-progress border-status-progress/20">
                <Calendar className="h-3.5 w-3.5" />
                Upcoming
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium bg-surface-hover text-muted border-border">
                Ended
              </span>
            )}
          </div>
          <div className="flex items-center gap-4 text-sm text-muted">
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              {formatDateTimeRange(event.date, event.endDate)} ({formatRelativeDate(event.date)})
            </span>
            {event.venue && (
              <span className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" />
                {event.venue}
              </span>
            )}
            {event.pageLink && (
              <a
                href={event.pageLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-accent hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Event Page
              </a>
            )}
          </div>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="secondary" size="sm" onClick={openEdit}>
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Button>
            {canDelete && (
              <Button variant="danger" size="sm" onClick={handleDelete}>
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </Button>
            )}
          </div>
        )}
      </div>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} className="p-6 max-w-md">
        <h2 className="text-lg font-semibold font-[family-name:var(--font-display)] mb-4">Edit Event</h2>
        <form onSubmit={saveEdit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Title *</label>
            <input
              type="text"
              value={editForm.title}
              onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
              required
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Start Date & Time *</label>
            <DateTimePicker
              required
              value={editForm.date}
              onChange={(date) => {
                setEditForm((f) => ({ ...f, date }));
                // Clear validation error when user changes the date
                if (dateValidationError) {
                  setDateValidationError(null);
                }
              }}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">End Date & Time *</label>
            <DateTimePicker
              required
              value={editForm.endDate}
              minDateTime={editForm.date} // Constrain end time to be after start time
              onChange={(endDate) => {
                setEditForm((f) => ({ ...f, endDate }));
                // Clear validation error when user changes the date
                if (dateValidationError) {
                  setDateValidationError(null);
                }
              }}
            />
            {dateValidationError && (
              <p className="text-sm text-status-blocked mt-1.5">
                {dateValidationError}
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Venue</label>
            <input
              type="text"
              value={editForm.venue}
              onChange={(e) => setEditForm((f) => ({ ...f, venue: e.target.value }))}
              placeholder="e.g. Community Hall, Room 101"
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Description</label>
            <textarea
              value={editForm.description}
              onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Event description"
              rows={3}
              className={cn(INPUT_CLASS, "min-h-[80px] resize-y")}
            />
          </div>
          <div>
            <label className="flex items-center gap-1.5 text-sm font-medium mb-1.5">
              <Link2 className="h-3.5 w-3.5" /> Event Page Link
            </label>
            <input
              type="url"
              value={editForm.pageLink}
              onChange={(e) => setEditForm((f) => ({ ...f, pageLink: e.target.value }))}
              placeholder="https://lu.ma/your-event"
              className={INPUT_CLASS}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={editSaving}>
              {editSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </Modal>

      <div className="flex items-center gap-1 border-b border-border mb-6">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const count =
            tab.id === "speakers" ? event.speakers.length :
            tab.id === "volunteers" ? event.volunteers.length :
            tab.id === "venues" ? event.venuePartners.length :
            tab.id === "checklist" ? allTasks.length : undefined;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-all cursor-pointer",
                activeTab === tab.id
                  ? "border-accent text-accent"
                  : "border-transparent text-muted hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
              {count !== undefined && (
                <span className="text-[10px] font-[family-name:var(--font-mono)] bg-surface-hover rounded-full px-1.5 py-0.5">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {activeTab === "overview" && (
        <BentoGrid className="lg:grid-cols-3">
          <BentoCard colSpan={2}>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted mb-2">About</h3>
            <p className="text-sm text-foreground/80">
              {event.description || "No description provided."}
            </p>
          </BentoCard>

          <StatCard label="SOP Progress" value={`${progress}%`}>
            <div className="mt-2 h-2 rounded-full bg-surface-active overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-accent to-amber-400 transition-all duration-700"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-1 text-[11px] font-[family-name:var(--font-mono)] text-muted">
              {doneTasks}/{allTasks.length} tasks done
            </p>
          </StatCard>

          <StatCard label="Speakers" value={event.speakers.length} icon={Mic2} />
          <StatCard label="Volunteers" value={event.volunteers.length} icon={Users} />
          <StatCard label="Venue Partners" value={event.venuePartners.length} icon={Building2} />
          <StatCard
            label="Lead"
            value={event.createdBy.name ?? "Unknown"}
          >
            <div className="mt-2">
              <OwnerAvatar name={event.createdBy.name} image={event.createdBy.image} size="md" />
            </div>
          </StatCard>
        </BentoGrid>
      )}

      {activeTab === "speakers" && (
        <div>
          {canEdit && (
            <div className="flex justify-end mb-4">
              <Button
                size="sm"
                onClick={() => {
                  loadSpeakers();
                  setSpkPickerOpen(true);
                }}
              >
                <Plus className="h-3.5 w-3.5" /> Add Speaker
              </Button>
            </div>
          )}

          {event.speakers.length === 0 ? (
            <EmptyState
              icon={Mic2}
              title="No speakers assigned"
              description={canEdit ? "Click 'Add Speaker' to link speakers from your directory." : "No speakers have been assigned to this event yet."}
            />
          ) : (
            <div className="bg-surface border border-border rounded-xl overflow-hidden">
              {event.speakers.map((es) => (
                <div
                  key={es.id}
                  className="flex items-center gap-4 px-5 py-3.5 border-b border-border last:border-0 hover:bg-surface-hover transition-colors group"
                >
                  <OwnerAvatar name={es.speaker.name} size="md" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{es.speaker.name}</p>
                    <p className="text-xs text-muted">{es.speaker.topic ?? es.speaker.email}</p>
                  </div>
                  <StatusBadge type="speaker" status={es.status} />
                  {canEdit && (
                    <button
                      onClick={() => unlinkSpeaker(es.speaker.id)}
                      className="p-1.5 rounded-lg text-muted hover:text-status-blocked hover:bg-status-blocked/10 transition-colors opacity-0 group-hover:opacity-100"
                      title="Remove speaker"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          <SpeakerPicker
            open={spkPickerOpen}
            onClose={() => setSpkPickerOpen(false)}
            speakers={allSpeakers}
            linkedIds={event.speakers.map((s) => s.speaker.id)}
            onLink={linkSpeaker}
          />
        </div>
      )}

      {activeTab === "volunteers" && (
        <div>
          {canEdit && (
            <div className="flex justify-end mb-4">
              <Button
                size="sm"
                onClick={() => {
                  loadVolunteersAndMembers();
                  setVolPickerOpen(true);
                }}
              >
                <Plus className="h-3.5 w-3.5" /> Add Volunteer
              </Button>
            </div>
          )}

          {event.volunteers.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No volunteers assigned"
              description={canEdit ? "Click 'Add Volunteer' to link volunteers from your directory or members." : "No volunteers have been assigned to this event yet."}
            />
          ) : (
            <div className="bg-surface border border-border rounded-xl overflow-hidden">
              {event.volunteers.map((ev) => (
                <div
                  key={ev.id}
                  className="flex items-center gap-4 px-5 py-3.5 border-b border-border last:border-0 hover:bg-surface-hover transition-colors group"
                >
                  <OwnerAvatar name={ev.volunteer.name} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{ev.volunteer.name}</p>
                      {ev.volunteer.userId && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 text-accent px-1.5 py-0.5 text-[10px] font-medium">
                          Member
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted">{ev.assignedRole ?? "No role assigned"}</p>
                  </div>
                  {(() => {
                    const counts = volunteerTaskCounts.get(ev.volunteer.id) ?? { completed: 0, total: 0 };
                    const isEligible = counts.completed >= MIN_VOLUNTEER_TASKS;
                    return (
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full border font-medium px-2.5 py-0.5 text-[11px]",
                          isEligible
                            ? "bg-status-done/15 text-status-done border-status-done/20"
                            : "bg-status-pending/15 text-status-pending border-status-pending/20"
                        )}
                        title={`${counts.completed} of ${MIN_VOLUNTEER_TASKS} required tasks completed (${counts.total} assigned)`}
                      >
                        {isEligible ? (
                          <Check className="h-3 w-3 shrink-0" />
                        ) : (
                          <ClipboardCheck className="h-3 w-3 shrink-0" />
                        )}
                        {counts.completed} / {MIN_VOLUNTEER_TASKS} tasks
                      </span>
                    );
                  })()}
                  {canEdit && (
                    <button
                      onClick={() => unlinkVolunteer(ev.volunteer.id)}
                      className="p-1.5 rounded-lg text-muted hover:text-status-blocked hover:bg-status-blocked/10 transition-colors opacity-0 group-hover:opacity-100"
                      title="Remove volunteer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          <VolunteerPicker
            open={volPickerOpen}
            onClose={() => setVolPickerOpen(false)}
            volunteers={allVolunteers}
            members={allMembers}
            linkedVolunteerIds={event.volunteers.map((v) => v.volunteer.id)}
            linkedMemberIds={linkedMemberIds}
            onLinkVolunteer={linkVolunteer}
            onLinkMember={linkMember}
          />
        </div>
      )}

      {activeTab === "venues" && (
        <div>
          {canEdit && (
            <div className="flex justify-end mb-4">
              <Button
                size="sm"
                onClick={() => {
                  loadVenuePartners();
                  setVenuePickerOpen(true);
                }}
              >
                <Plus className="h-3.5 w-3.5" /> Add Venue Partner
              </Button>
            </div>
          )}

          {event.venuePartners.length === 0 ? (
            <EmptyState
              icon={Building2}
              title="No venue partners assigned"
              description={canEdit ? "Click 'Add Venue Partner' to link venue partners from your directory." : "No venue partners have been assigned to this event yet."}
            />
          ) : (
            <VenuePartnerList
              venuePartners={event.venuePartners}
              canEdit={canEdit}
              venueStatusUpdating={venueStatusUpdating}
              onStatusChange={(linkId, status) => {
                setVenueStatusUpdating(linkId);
                updateVenueLink(linkId, { status }).finally(() =>
                  setVenueStatusUpdating(null)
                );
              }}
              canConfirmVenue={isAdmin}
              canSendVenueRequest={isAdmin}
              onUnlink={unlinkVenuePartner}
              onOpenVenueRequest={openVenueRequestComposer}
            />
          )}

          <VenuePartnerPicker
            open={venuePickerOpen}
            onClose={() => setVenuePickerOpen(false)}
            venues={allVenuePartners}
            linkedIds={event.venuePartners.map((v) => v.venuePartner.id)}
            onLink={linkVenuePartner}
          />

          {/* Venue confirmation switch warning modal */}
          <Modal open={!!venueConfirmModal} onClose={() => setVenueConfirmModal(null)} className="p-6 max-w-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-full bg-status-blocked/15 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5 text-status-blocked" />
              </div>
              <h2 className="text-lg font-semibold font-[family-name:var(--font-display)]">
                Switch Confirmed Venue?
              </h2>
            </div>
            <p className="text-sm text-muted mb-4">
              This event already has a confirmed venue (<strong>{venueConfirmModal?.existingName}</strong>).
              Confirming this venue will reset the previous one to Pending.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setVenueConfirmModal(null)}>
                Cancel
              </Button>
              <Button size="sm" onClick={confirmVenueSwitch}>
                Confirm Switch
              </Button>
            </div>
          </Modal>

          <Modal open={!!venueRequestModal} onClose={() => setVenueRequestModal(null)} className="p-6 max-w-2xl">
            <div className="flex items-start gap-3 mb-4">
              <div className="h-10 w-10 rounded-full bg-accent/15 flex items-center justify-center shrink-0">
                <Mail className="h-5 w-5 text-accent" />
              </div>
              <div>
                <h2 className="text-lg font-semibold font-[family-name:var(--font-display)]">
                  Venue Request Email
                </h2>
                <p className="text-sm text-muted">
                  Review and edit the draft before sending to{" "}
                  <strong>{venueRequestModal?.venueName}</strong>{" "}
                  ({venueRequestModal?.venueEmail}).
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1.5">Subject</label>
                <input
                  type="text"
                  value={venueRequestSubject}
                  onChange={(e) => setVenueRequestSubject(e.target.value)}
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Message</label>
                <textarea
                  value={venueRequestBody}
                  onChange={(e) => setVenueRequestBody(e.target.value)}
                  rows={16}
                  className={cn(INPUT_CLASS, "min-h-[280px] font-[family-name:var(--font-mono)]")}
                />
              </div>
              {venueRequestError && (
                <p className="text-sm text-status-blocked">{venueRequestError}</p>
              )}
              {venueRequestSuccess && (
                <p className="text-sm text-status-done">{venueRequestSuccess}</p>
              )}
              <div className="flex justify-end gap-2 pt-1">
                <Button
                  variant="secondary"
                  onClick={() => setVenueRequestModal(null)}
                  disabled={venueRequestSending}
                >
                  Cancel
                </Button>
                <Button onClick={sendVenueRequestEmail} disabled={venueRequestSending}>
                  <Send className="h-4 w-4" />
                  {venueRequestSending ? "Sending..." : "Send Request"}
                </Button>
              </div>
            </div>
          </Modal>
        </div>
      )}

      {/* SOP Venue Confirmation Block Modal */}
      <Modal open={sopBlockModal} onClose={() => setSopBlockModal(false)} className="p-6 max-w-sm">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-10 w-10 rounded-full bg-status-blocked/15 flex items-center justify-center shrink-0">
            <AlertTriangle className="h-5 w-5 text-status-blocked" />
          </div>
          <h2 className="text-lg font-semibold font-[family-name:var(--font-display)]">
            Venue Not Confirmed
          </h2>
        </div>
        <p className="text-sm text-muted mb-2">
          Please confirm a venue partner before marking this task as complete.
        </p>
        <p className="text-xs text-muted mb-4">
          Go to the &quot;Venue Partners&quot; tab and set a venue partner status to &quot;Confirmed&quot;.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={() => setSopBlockModal(false)}>
            Close
          </Button>
          <Button size="sm" onClick={() => { setSopBlockModal(false); setActiveTab("venues"); }}>
            Go to Venue Partners
          </Button>
        </div>
      </Modal>

      {activeTab === "checklist" && (
        <ChecklistTab
          checklists={event.checklists}
          eventVolunteers={event.volunteers}
          onUpdateTask={updateTask}
          readOnly={isReadOnly}
          volunteerMode={isVolunteer}
          currentVolunteerId={myVolunteerId}
          isAdmin={isAdmin}
          eventId={id}
          onTemplateChanged={fetchEvent}
        />
      )}
    </div>
  );
}
