"use client";

import { PageHeader, EmptyState, Button, PriorityBadge, Modal } from "@/components/design-system";
import { ClipboardCheck, Plus, Pencil, Trash2, X, ChevronDown, ChevronRight, Copy, FileText } from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";

type Section = "PRE_EVENT" | "ON_DAY" | "POST_EVENT";

type DefaultTask = {
  title: string;
  relativeDays: number;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  section: Section;
  subcategory?: string;
};

type Template = {
  id: string;
  name: string;
  description: string | null;
  defaultTasks: DefaultTask[];
  createdAt: string;
  updatedAt: string;
};

const INPUT_CLASS =
  "w-full bg-background border border-border rounded-lg px-3.5 py-2.5 text-sm placeholder:text-muted/50 focus:border-accent focus:ring-1 focus:ring-accent/30 outline-none transition-all";

const PRIORITIES: DefaultTask["priority"][] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

const SECTION_META: Record<Section, { label: string; color: string }> = {
  PRE_EVENT: { label: "Pre-Event", color: "text-blue-400" },
  ON_DAY: { label: "On-Day", color: "text-amber-400" },
  POST_EVENT: { label: "Post-Event", color: "text-emerald-400" },
};

const SECTIONS: Section[] = ["PRE_EVENT", "ON_DAY", "POST_EVENT"];

const DEFAULT_SUBCATEGORIES: Record<Section, string[]> = {
  PRE_EVENT: ["Planning & Coordination", "Creatives & Content", "Event Page & Registration", "Promotions & Announcements", "Venue & Logistics", "Volunteer Coordination"],
  ON_DAY: ["Venue Setup & Live Operations", "During the Event", "Awards & Recognition"],
  POST_EVENT: ["Follow-ups & Wrap-up"],
};

function inferSection(relativeDays: number): Section {
  if (relativeDays > 0) return "PRE_EVENT";
  if (relativeDays === 0) return "ON_DAY";
  return "POST_EVENT";
}

function normalizeTask(t: Record<string, unknown>): DefaultTask {
  const section = SECTIONS.includes(t.section as Section)
    ? (t.section as Section)
    : inferSection(Number(t.relativeDays) || 0);
  return {
    title: String(t.title ?? ""),
    relativeDays: Number(t.relativeDays) || 0,
    priority: PRIORITIES.includes(t.priority as DefaultTask["priority"])
      ? (t.priority as DefaultTask["priority"])
      : "MEDIUM",
    section,
    subcategory: typeof t.subcategory === "string" ? t.subcategory : undefined,
  };
}

function TemplateFormModal({
  template,
  onClose,
  onSuccess,
}: {
  template: Template | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const isEdit = !!template;
  const [name, setName] = useState(template?.name ?? "");
  const [description, setDescription] = useState(template?.description ?? "");

  // Group tasks by section → subcategory
  type SubcategoryGroup = { subcategory: string; tasks: DefaultTask[] };
  type SectionData = SubcategoryGroup[];

  const buildInitialState = (): Record<Section, SectionData> => {
    const state: Record<Section, SectionData> = { PRE_EVENT: [], ON_DAY: [], POST_EVENT: [] };
    if (template?.defaultTasks?.length) {
      // Group existing tasks by section + subcategory
      const map = new Map<string, DefaultTask[]>();
      for (const t of template.defaultTasks) {
        const task = normalizeTask(t as unknown as Record<string, unknown>);
        const key = `${task.section}::${task.subcategory || "General"}`;
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(task);
      }
      for (const [key, tasks] of map) {
        const [sec, sub] = key.split("::");
        if (SECTIONS.includes(sec as Section)) {
          state[sec as Section].push({ subcategory: sub, tasks });
        }
      }
    }
    // Ensure at least one subcategory per section if empty
    for (const sec of SECTIONS) {
      if (state[sec].length === 0) {
        state[sec].push({
          subcategory: DEFAULT_SUBCATEGORIES[sec][0] || "General",
          tasks: sec === "PRE_EVENT" ? [{ title: "", relativeDays: 7, priority: "MEDIUM", section: sec }] : [],
        });
      }
    }
    return state;
  };

  const [sectionData, setSectionData] = useState(buildInitialState);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const serializeFormState = (
    currentName: string,
    currentDescription: string,
    currentSectionData: Record<Section, SectionData>
  ) => JSON.stringify({
    name: currentName,
    description: currentDescription,
    sectionData: currentSectionData,
  });

  const initialSnapshotRef = useRef(
    serializeFormState(name, description, sectionData)
  );

  const hasUnsavedChanges =
    serializeFormState(name, description, sectionData) !==
    initialSnapshotRef.current;

  const handleClose = (force = false) => {
    if (!force && hasUnsavedChanges && !submitting) {
      const shouldDiscard = window.confirm(
        "Changes will be lost if you close this template. Do you want to discard changes?"
      );
      if (!shouldDiscard) return;
    }
    onClose();
  };

  const addSubcategory = (section: Section) => {
    const existing = sectionData[section].map((g) => g.subcategory);
    const available = DEFAULT_SUBCATEGORIES[section].filter((s) => !existing.includes(s));
    const newSub = available.length > 0 ? available[0] : `Subcategory ${existing.length + 1}`;
    const defaults: Record<Section, number> = { PRE_EVENT: 7, ON_DAY: 0, POST_EVENT: -1 };
    setSectionData((prev) => ({
      ...prev,
      [section]: [...prev[section], { subcategory: newSub, tasks: [{ title: "", relativeDays: defaults[section], priority: "MEDIUM" as const, section }] }],
    }));
  };

  const removeSubcategory = (section: Section, subIndex: number) => {
    setSectionData((prev) => ({
      ...prev,
      [section]: prev[section].filter((_, i) => i !== subIndex),
    }));
  };

  const updateSubcategoryName = (section: Section, subIndex: number, name: string) => {
    setSectionData((prev) => ({
      ...prev,
      [section]: prev[section].map((g, i) => (i === subIndex ? { ...g, subcategory: name } : g)),
    }));
  };

  const addTask = (section: Section, subIndex: number) => {
    const defaults: Record<Section, number> = { PRE_EVENT: 7, ON_DAY: 0, POST_EVENT: -1 };
    setSectionData((prev) => ({
      ...prev,
      [section]: prev[section].map((g, i) =>
        i === subIndex
          ? { ...g, tasks: [...g.tasks, { title: "", relativeDays: defaults[section], priority: "MEDIUM" as const, section }] }
          : g
      ),
    }));
  };

  const removeTask = (section: Section, subIndex: number, taskIndex: number) => {
    setSectionData((prev) => ({
      ...prev,
      [section]: prev[section].map((g, i) =>
        i === subIndex ? { ...g, tasks: g.tasks.filter((_, ti) => ti !== taskIndex) } : g
      ),
    }));
  };

  const updateTask = (section: Section, subIndex: number, taskIndex: number, field: keyof DefaultTask, value: string | number) => {
    setSectionData((prev) => ({
      ...prev,
      [section]: prev[section].map((g, i) =>
        i === subIndex
          ? { ...g, tasks: g.tasks.map((t, ti) => (ti === taskIndex ? { ...t, [field]: value } : t)) }
          : g
      ),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    const allTasks: DefaultTask[] = SECTIONS.flatMap((section) =>
      sectionData[section].flatMap((group) =>
        group.tasks
          .filter((t) => t.title.trim().length > 0)
          .map((t) => ({
            title: t.title.trim(),
            relativeDays: Number(t.relativeDays) || 0,
            priority: PRIORITIES.includes(t.priority) ? t.priority : "MEDIUM",
            section,
            subcategory: group.subcategory.trim() || undefined,
          }))
      )
    );

    setSubmitting(true);
    try {
      const url = isEdit ? `/api/templates/${template.id}` : "/api/templates";
      const method = isEdit ? "PATCH" : "POST";
      const body = {
        name: name.trim(),
        description: description.trim() || undefined,
        defaultTasks: allTasks,
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
      handleClose(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open onClose={() => handleClose()} className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
        <h2 className="text-lg font-semibold font-[family-name:var(--font-display)]">
          {isEdit ? "Edit Template" : "New Template"}
        </h2>
        <button
          onClick={() => handleClose()}
          className="p-2 rounded-lg text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1 overflow-hidden">
        <div className="p-5 space-y-4 overflow-y-auto">
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
              placeholder="Template name"
              className={INPUT_CLASS}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              className={cn(INPUT_CLASS, "min-h-[72px] resize-y")}
              rows={2}
            />
          </div>

          {SECTIONS.map((section) => (
            <div key={section}>
              <div className="flex items-center justify-between mb-2">
                <span className={cn("text-sm font-semibold", SECTION_META[section].color)}>
                  {SECTION_META[section].label}
                </span>
                <Button type="button" variant="secondary" size="sm" onClick={() => addSubcategory(section)}>
                  <Plus className="h-3.5 w-3.5" />
                  Add Subcategory
                </Button>
              </div>
              {sectionData[section].length === 0 ? (
                <p className="text-xs text-muted italic pl-1 pb-2">No subcategories in this section</p>
              ) : (
                <div className="space-y-3">
                  {sectionData[section].map((group, subIndex) => (
                    <div key={subIndex} className="border border-border/60 rounded-lg overflow-hidden">
                      <div className="flex items-center gap-2 px-3 py-2 bg-surface-hover/30 border-b border-border/40">
                        <select
                          value={DEFAULT_SUBCATEGORIES[section].includes(group.subcategory) ? group.subcategory : "__custom__"}
                          onChange={(e) => {
                            if (e.target.value !== "__custom__") updateSubcategoryName(section, subIndex, e.target.value);
                          }}
                          className="flex-1 bg-transparent border-none text-xs font-medium text-foreground outline-none cursor-pointer"
                        >
                          {DEFAULT_SUBCATEGORIES[section].map((sub) => (
                            <option key={sub} value={sub}>{sub}</option>
                          ))}
                          {!DEFAULT_SUBCATEGORIES[section].includes(group.subcategory) && (
                            <option value="__custom__">{group.subcategory}</option>
                          )}
                        </select>
                        <input
                          type="text"
                          value={group.subcategory}
                          onChange={(e) => updateSubcategoryName(section, subIndex, e.target.value)}
                          placeholder="Subcategory name"
                          className="flex-1 bg-transparent border-none text-xs font-medium text-foreground outline-none placeholder:text-muted/50"
                        />
                        <Button type="button" variant="ghost" size="icon" onClick={() => addTask(section, subIndex)} className="shrink-0" aria-label="Add task">
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeSubcategory(section, subIndex)}
                          className="shrink-0 text-muted hover:text-status-blocked"
                          aria-label="Remove subcategory"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      {group.tasks.length === 0 ? (
                        <p className="text-xs text-muted italic px-3 py-2">No tasks – click + to add</p>
                      ) : (
                        <div className="space-y-2 p-2">
                          {group.tasks.map((task, taskIndex) => (
                            <div
                              key={taskIndex}
                              className="flex items-start gap-2 p-3 rounded-lg border border-border bg-background/50"
                            >
                              <div className="flex-1 space-y-2 min-w-0">
                                <input
                                  type="text"
                                  value={task.title}
                                  onChange={(e) => updateTask(section, subIndex, taskIndex, "title", e.target.value)}
                                  placeholder="Task title"
                                  className={INPUT_CLASS}
                                />
                                <div className="flex gap-2 items-center">
                                  <div className="flex-1 min-w-0">
                                    <input
                                      type="number"
                                      value={task.relativeDays}
                                      onChange={(e) =>
                                        updateTask(section, subIndex, taskIndex, "relativeDays", parseInt(e.target.value, 10) || 0)
                                      }
                                      placeholder="Days"
                                      className={INPUT_CLASS}
                                    />
                                    <span className="text-xs text-muted mt-0.5 block">
                                      {section === "POST_EVENT"
                                        ? "Days after event (use negative)"
                                        : section === "ON_DAY"
                                          ? "Day of event (0)"
                                          : "Days before event"}
                                    </span>
                                  </div>
                                  <div className="w-32 shrink-0">
                                    <select
                                      value={task.priority}
                                      onChange={(e) =>
                                        updateTask(section, subIndex, taskIndex, "priority", e.target.value as DefaultTask["priority"])
                                      }
                                      className={INPUT_CLASS}
                                    >
                                      {PRIORITIES.map((p) => (
                                        <option key={p} value={p}>
                                          {p}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                </div>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removeTask(section, subIndex, taskIndex)}
                                className="shrink-0 text-muted hover:text-status-blocked"
                                aria-label="Remove task"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-border shrink-0">
          <Button type="button" variant="secondary" onClick={() => handleClose()}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving…" : isEdit ? "Save" : "Create Template"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function groupBySection(taskList: DefaultTask[]): Record<Section, DefaultTask[]> {
  const groups: Record<Section, DefaultTask[]> = { PRE_EVENT: [], ON_DAY: [], POST_EVENT: [] };
  for (const t of taskList) {
    const task = normalizeTask(t as unknown as Record<string, unknown>);
    groups[task.section].push(task);
  }
  return groups;
}

type SubcategoryGroupDisplay = { subcategory: string; tasks: DefaultTask[] };

function groupBySectionAndSubcategory(taskList: DefaultTask[]): Record<Section, SubcategoryGroupDisplay[]> {
  const result: Record<Section, SubcategoryGroupDisplay[]> = { PRE_EVENT: [], ON_DAY: [], POST_EVENT: [] };
  const map = new Map<string, DefaultTask[]>();
  const order: string[] = [];

  for (const t of taskList) {
    const task = normalizeTask(t as unknown as Record<string, unknown>);
    const key = `${task.section}::${task.subcategory || "General"}`;
    if (!map.has(key)) {
      map.set(key, []);
      order.push(key);
    }
    map.get(key)!.push(task);
  }

  for (const key of order) {
    const [sec, sub] = key.split("::");
    if (SECTIONS.includes(sec as Section)) {
      result[sec as Section].push({ subcategory: sub, tasks: map.get(key)! });
    }
  }

  return result;
}

export default function SOPTemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [creatingDefault, setCreatingDefault] = useState(false);

  const createDefaultSOP = async () => {
    setCreatingDefault(true);
    try {
      const res = await fetch("/api/templates/default", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? "Failed to create default SOP");
        return;
      }
      await fetchTemplates();
    } catch {
      alert("Failed to create default SOP");
    } finally {
      setCreatingDefault(false);
    }
  };

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch("/api/templates");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setTemplates(data);
    } catch {
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const openNewModal = () => {
    setEditingTemplate(null);
    setModalOpen(true);
  };

  const openEditModal = (template: Template) => {
    setEditingTemplate(template);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingTemplate(null);
  };

  const handleDuplicate = async (template: Template) => {
    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${template.name} (Copy)`,
          description: template.description ?? undefined,
          defaultTasks: template.defaultTasks,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to duplicate");
      }
      await fetchTemplates();
    } catch {
      alert("Failed to duplicate template");
    }
  };

  const handleDelete = async (template: Template) => {
    if (!confirm(`Delete template "${template.name}"? This will not affect existing checklists.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/templates/${template.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      await fetchTemplates();
      if (expandedId === template.id) setExpandedId(null);
    } catch {
      alert("Failed to delete template");
    }
  };

  const tasks = (t: Template) => {
    const d = t.defaultTasks;
    return Array.isArray(d) ? (d as DefaultTask[]) : [];
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="SOP Templates"
        description="Manage reusable checklists for events"
        actions={
          <div className="flex items-center gap-2">
            <Button size="md" variant="secondary" onClick={createDefaultSOP} disabled={creatingDefault}>
              <FileText className="h-4 w-4" />
              {creatingDefault ? "Creating…" : "Create Default SOP"}
            </Button>
            <Button size="md" onClick={openNewModal}>
              <Plus className="h-4 w-4" />
              New Template
            </Button>
          </div>
        }
      />

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-border bg-surface p-5 animate-shimmer"
            >
              <div className="h-5 w-48 rounded bg-muted/30" />
              <div className="mt-2 h-4 w-64 rounded bg-muted/20" />
            </div>
          ))}
        </div>
      ) : templates.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="No templates yet"
          description="Create reusable checklists for your events, or start with the default KUG Chennai SOP"
          action={
            <div className="flex items-center gap-2">
              <Button size="md" onClick={createDefaultSOP} disabled={creatingDefault}>
                <FileText className="h-4 w-4" />
                {creatingDefault ? "Creating…" : "Create Default SOP"}
              </Button>
              <Button size="md" variant="secondary" onClick={openNewModal}>
                <Plus className="h-4 w-4" />
                New Template
              </Button>
            </div>
          }
        />
      ) : (
        <div className="space-y-4">
          {templates.map((template) => {
            const taskList = tasks(template);
            const grouped = groupBySection(taskList);
            const groupedSub = groupBySectionAndSubcategory(taskList);
            const hasSubcategories = taskList.some((t) => t.subcategory);
            const isExpanded = expandedId === template.id;

            return (
              <div
                key={template.id}
                className="rounded-xl border border-border bg-surface overflow-hidden"
              >
                <div
                  className="flex items-center gap-4 p-5 cursor-pointer hover:bg-surface-hover/50 transition-colors"
                  onClick={() => setExpandedId((prev) => (prev === template.id ? null : template.id))}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{template.name}</p>
                    {template.description && (
                      <p className="text-sm text-muted truncate mt-0.5">
                        {template.description}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-1">
                      <p className="text-xs text-muted">
                        {taskList.length} task{taskList.length !== 1 ? "s" : ""}
                      </p>
                      <div className="flex items-center gap-2 text-[11px]">
                        <span className={SECTION_META.PRE_EVENT.color}>{grouped.PRE_EVENT.length} pre</span>
                        <span className="text-muted/30">|</span>
                        <span className={SECTION_META.ON_DAY.color}>{grouped.ON_DAY.length} day</span>
                        <span className="text-muted/30">|</span>
                        <span className={SECTION_META.POST_EVENT.color}>{grouped.POST_EVENT.length} post</span>
                      </div>
                    </div>
                  </div>
                  <div
                    className="flex items-center gap-1 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditModal(template)}
                      aria-label="Edit template"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDuplicate(template)}
                      aria-label="Duplicate template"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(template)}
                      aria-label="Delete template"
                      className="text-status-blocked hover:text-status-blocked"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {isExpanded && taskList.length > 0 && (
                  <div className="border-t border-border px-5 py-4 bg-background/30 space-y-5">
                    {SECTIONS.map((section) => {
                      const sectionTasks = grouped[section];
                      if (sectionTasks.length === 0) return null;
                      const subcategories = groupedSub[section];

                      return (
                        <div key={section}>
                          <p className={cn("text-xs font-semibold uppercase tracking-wider mb-2", SECTION_META[section].color)}>
                            {SECTION_META[section].label}
                          </p>
                          {hasSubcategories && subcategories.length > 0 ? (
                            <div className="space-y-3">
                              {subcategories.map((subGroup, subIdx) => (
                                <div key={subIdx}>
                                  <p className="text-[11px] font-medium text-muted/80 uppercase tracking-wider mb-1.5 pl-1">
                                    {subGroup.subcategory}
                                  </p>
                                  <ul className="space-y-1.5">
                                    {subGroup.tasks.map((task, idx) => (
                                      <li
                                        key={idx}
                                        className="flex items-center gap-3 text-sm py-2 px-3 rounded-lg bg-surface border border-border/50"
                                      >
                                        <span className="flex-1 truncate">{task.title}</span>
                                        <span className="text-muted shrink-0 text-xs">
                                          {task.relativeDays === 0
                                            ? "Day of"
                                            : task.relativeDays > 0
                                              ? `${task.relativeDays}d before`
                                              : `${Math.abs(task.relativeDays)}d after`}
                                        </span>
                                        <PriorityBadge priority={task.priority} size="sm" />
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <ul className="space-y-1.5">
                              {sectionTasks.map((task, idx) => (
                                <li
                                  key={idx}
                                  className="flex items-center gap-3 text-sm py-2 px-3 rounded-lg bg-surface border border-border/50"
                                >
                                  <span className="flex-1 truncate">{task.title}</span>
                                  <span className="text-muted shrink-0 text-xs">
                                    {task.relativeDays === 0
                                      ? "Day of"
                                      : task.relativeDays > 0
                                        ? `${task.relativeDays}d before`
                                        : `${Math.abs(task.relativeDays)}d after`}
                                  </span>
                                  <PriorityBadge priority={task.priority} size="sm" />
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {modalOpen && (
        <TemplateFormModal
          template={editingTemplate}
          onClose={closeModal}
          onSuccess={fetchTemplates}
        />
      )}
    </div>
  );
}
