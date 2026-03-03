"use client";

import { PageHeader, Button } from "@/components/design-system";
import { useSession } from "next-auth/react";
import { useState, useEffect, useRef } from "react";
import { Users, Save, Check, Type, ClipboardCheck, Mail, Send, AlertCircle, Shield, ImagePlus, ChevronDown, Clock } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useAppSettings } from "@/lib/app-settings-context";

const INPUT_CLASS =
  "w-full bg-background border border-border rounded-lg px-3.5 py-2.5 text-sm placeholder:text-muted/50 focus:border-accent focus:ring-1 focus:ring-accent/30 outline-none transition-all";

function AppConfigCard() {
  const { meetupName, setMeetupName, meetupWebsite, meetupPastEventLink, minVolunteerTasks, setMinVolunteerTasks, minEventDuration, setMinEventDuration, logoLight, setLogoLight, logoDark, setLogoDark } = useAppSettings();
  const [config, setConfig] = useState({
    meetupName: "",
    meetupDescription: "",
    meetupWebsite: "",
    meetupPastEventLink: "",
    volunteerThreshold: "5",
    minVolunteerTasks: "7", 
    minEventDuration: "4"
  });
  const [lightPreview, setLightPreview] = useState<string | null>(null);
  const [darkPreview, setDarkPreview] = useState<string | null>(null);
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isExpanded, setIsExpanded] = useState(false);
  const lightInputRef = useRef<HTMLInputElement>(null);
  const darkInputRef = useRef<HTMLInputElement>(null);

  // Load initial values from context and API
  useEffect(() => {
    setConfig(prev => ({
      ...prev,
      meetupName,
      meetupWebsite,
      meetupPastEventLink,
      minVolunteerTasks: String(minVolunteerTasks),
      minEventDuration: String(minEventDuration)
    }));

    // Load volunteer threshold from API
    fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : {}))
      .then((data: Record<string, string>) => {
        setConfig(prev => ({
          ...prev,
          meetupDescription: data.meetup_description ?? "",
          meetupWebsite: data.meetup_website ?? "",
          meetupPastEventLink: data.meetup_past_event_link ?? "",
        }));
        if (data.volunteer_promotion_threshold) {
          setConfig(prev => ({ ...prev, volunteerThreshold: data.volunteer_promotion_threshold }));
        }
      })
      .catch(() => {});
  }, [meetupName, meetupWebsite, meetupPastEventLink, minVolunteerTasks, minEventDuration]);

  useEffect(() => {
    setLightPreview(logoLight);
  }, [logoLight]);

  useEffect(() => {
    setDarkPreview(logoDark);
  }, [logoDark]);

  const handleSave = async (key: string, value: string, contextSetter?: (v: string) => void) => {
    // Validation
    if (key === 'meetupName') {
      const trimmed = value.trim();
      if (!trimmed) {
        setErrors(prev => ({ ...prev, [key]: "Meetup name cannot be empty" }));
        return;
      }
      value = trimmed;
    } else if (key === "meetupDescription" || key === "meetupWebsite" || key === "meetupPastEventLink") {
      value = value.trim();
    } else if (['volunteerThreshold', 'minVolunteerTasks', 'minEventDuration'].includes(key)) {
      const num = parseInt(value, 10);
      if (isNaN(num) || num < 1) {
        setErrors(prev => ({ ...prev, [key]: "Must be a number greater than 0" }));
        return;
      }
      if (key === 'minEventDuration' && num > 168) { // Max 1 week
        setErrors(prev => ({ ...prev, [key]: "Maximum event duration is 168 hours (1 week)" }));
        return;
      }
    }

    setSaving(prev => ({ ...prev, [key]: true }));
    setErrors(prev => ({ ...prev, [key]: "" }));
    setSaved(prev => ({ ...prev, [key]: false }));
    
    try {
      const apiKey = {
        meetupName: 'meetup_name',
        meetupDescription: "meetup_description",
        meetupWebsite: "meetup_website",
        meetupPastEventLink: "meetup_past_event_link",
        volunteerThreshold: 'volunteer_promotion_threshold',
        minVolunteerTasks: 'min_volunteer_tasks',
        minEventDuration: 'min_event_duration'
      }[key];

      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: apiKey, value }),
      });
      
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to save");
      }

      // Update context if available
      if (contextSetter) {
        contextSetter(value);
      }

      setSaved(prev => ({ ...prev, [key]: true }));
      setTimeout(() => setSaved(prev => ({ ...prev, [key]: false })), 2000);
    } catch (e) {
      setErrors(prev => ({ ...prev, [key]: e instanceof Error ? e.message : "Failed to save" }));
    } finally {
      setSaving(prev => ({ ...prev, [key]: false }));
    }
  };

  // Logo upload functionality
  const MAX_SIZE = 200 * 1024; // 200KB
  const ACCEPT = "image/png,image/jpeg,image/svg+xml,image/webp";

  const handleFile = (file: File, variant: "logo_light" | "logo_dark") => {
    if (file.size > MAX_SIZE) {
      setErrors(prev => ({ ...prev, logoUpload: `Image too large (${(file.size / 1024).toFixed(0)}KB). Max 200KB.` }));
      return;
    }
    if (!["image/png", "image/jpeg", "image/svg+xml", "image/webp"].includes(file.type)) {
      setErrors(prev => ({ ...prev, logoUpload: "Only PNG, JPEG, SVG, and WebP images are supported." }));
      return;
    }
    setErrors(prev => ({ ...prev, logoUpload: "" }));

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUri = reader.result as string;

      if (variant === "logo_light") setLightPreview(dataUri);
      else setDarkPreview(dataUri);

      setSaving(prev => ({ ...prev, [variant]: true }));
      setSaved(prev => ({ ...prev, [variant]: false }));
      try {
        const res = await fetch("/api/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: variant, value: dataUri }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "Failed to save");
        }
        if (variant === "logo_light") setLogoLight(dataUri);
        else setLogoDark(dataUri);
        setSaved(prev => ({ ...prev, [variant]: true }));
        setTimeout(() => setSaved(prev => ({ ...prev, [variant]: false })), 2000);
      } catch (e) {
        setErrors(prev => ({ ...prev, logoUpload: e instanceof Error ? e.message : "Failed to save" }));
        if (variant === "logo_light") setLightPreview(logoLight);
        else setDarkPreview(logoDark);
      } finally {
        setSaving(prev => ({ ...prev, [variant]: false }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemove = async (variant: "logo_light" | "logo_dark") => {
    setSaving(prev => ({ ...prev, [variant]: true }));
    setErrors(prev => ({ ...prev, logoUpload: "" }));
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: variant, value: "" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to remove");
      }
      if (variant === "logo_light") {
        setLogoLight(null);
        setLightPreview(null);
      } else {
        setLogoDark(null);
        setDarkPreview(null);
      }
      setSaved(prev => ({ ...prev, [variant]: true }));
      setTimeout(() => setSaved(prev => ({ ...prev, [variant]: false })), 2000);
    } catch (e) {
      setErrors(prev => ({ ...prev, logoUpload: e instanceof Error ? e.message : "Failed to remove" }));
    } finally {
      setSaving(prev => ({ ...prev, [variant]: false }));
    }
  };

  const renderUploadZone = (
    variant: "logo_light" | "logo_dark",
    label: string,
    preview: string | null,
    inputRef: React.RefObject<HTMLInputElement | null>,
    bgClass: string
  ) => (
    <div className="flex-1 min-w-[200px]">
      <label className="block text-sm font-medium mb-1.5">{label}</label>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file, variant);
          e.target.value = "";
        }}
      />
      {preview ? (
        <div className={cn("relative rounded-lg border border-border p-4 flex items-center gap-4", bgClass)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt={label}
            className="h-12 w-12 object-contain rounded"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="text-xs px-3 py-1.5 rounded-md border border-border bg-surface hover:bg-surface-hover transition-colors"
              disabled={saving[variant]}
            >
              Replace
            </button>
            <button
              type="button"
              onClick={() => handleRemove(variant)}
              className="text-xs px-3 py-1.5 rounded-md border border-status-blocked/30 text-status-blocked hover:bg-status-blocked/10 transition-colors"
              disabled={saving[variant]}
            >
              Remove
            </button>
          </div>
          {saving[variant] && (
            <span className="text-xs text-muted ml-auto">Saving…</span>
          )}
          {saved[variant] && (
            <span className="text-xs text-status-done ml-auto flex items-center gap-1">
              <Check className="h-3 w-3" /> Saved
            </span>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={cn(
            "w-full rounded-lg border-2 border-dashed border-border p-6 flex flex-col items-center gap-2 hover:border-accent/50 hover:bg-accent/5 transition-colors cursor-pointer",
            bgClass
          )}
          disabled={saving[variant]}
        >
          <ImagePlus className="h-6 w-6 text-muted" />
          <span className="text-sm text-muted">
            {saving[variant] ? "Uploading…" : "Click to upload"}
          </span>
          <span className="text-xs text-muted/60">PNG, JPEG, SVG, WebP · Max 200KB</span>
        </button>
      )}
    </div>
  );

  return (
    <div className="bg-surface border border-border rounded-xl p-6">
      <div 
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-accent/10 text-accent">
            <Type className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold mb-1">App Configuration</h3>
            <p className="text-sm text-muted">
              Configure core application settings and thresholds for your organization.
            </p>
          </div>
        </div>
        <ChevronDown className={cn(
          "h-5 w-5 text-muted transition-transform",
          isExpanded && "rotate-180"
        )} />
      </div>

      {isExpanded && (
        <div className="mt-6 space-y-6">
        {/* Meetup Name */}
        <div>
          <div className="flex items-end gap-3">
            <div className="flex-1 max-w-[320px]">
              <label className="block text-sm font-medium mb-1.5">
                Meetup Name
              </label>
              <input
                type="text"
                value={config.meetupName}
                onChange={(e) => {
                  setConfig(prev => ({ ...prev, meetupName: e.target.value }));
                  setSaved(prev => ({ ...prev, meetupName: false }));
                }}
                placeholder="e.g. React Bangalore"
                className={INPUT_CLASS}
              />
            </div>
            <Button
              size="md"
              onClick={() => handleSave('meetupName', config.meetupName, setMeetupName)}
              disabled={saving.meetupName}
              className={cn(saved.meetupName && "bg-status-done/15 text-status-done border-status-done/20")}
            >
              {saved.meetupName ? (
                <>
                  <Check className="h-4 w-4" /> Saved
                </>
              ) : saving.meetupName ? (
                "Saving…"
              ) : (
                <>
                  <Save className="h-4 w-4" /> Save
                </>
              )}
            </Button>
          </div>
          {errors.meetupName && <p className="mt-2 text-sm text-status-blocked">{errors.meetupName}</p>}
        </div>

        {/* Meetup Group Description */}
        <div>
          <div className="flex flex-col gap-3">
            <div className="max-w-[640px]">
              <label className="block text-sm font-medium mb-1.5">
                Meetup Group Description
              </label>
              <textarea
                value={config.meetupDescription}
                onChange={(e) => {
                  setConfig(prev => ({ ...prev, meetupDescription: e.target.value }));
                  setSaved(prev => ({ ...prev, meetupDescription: false }));
                }}
                placeholder="Share what your meetup group is about, who it is for, and what members can expect."
                rows={4}
                className={INPUT_CLASS}
              />
              <p className="mt-1 text-xs text-muted">
                Optional. This can be shown on public or onboarding pages.
              </p>
            </div>
            <div>
              <Button
                size="md"
                onClick={() => handleSave("meetupDescription", config.meetupDescription)}
                disabled={saving.meetupDescription}
                className={cn(saved.meetupDescription && "bg-status-done/15 text-status-done border-status-done/20")}
              >
                {saved.meetupDescription ? (
                  <>
                    <Check className="h-4 w-4" /> Saved
                  </>
                ) : saving.meetupDescription ? (
                  "Saving…"
                ) : (
                  <>
                    <Save className="h-4 w-4" /> Save
                  </>
                )}
              </Button>
            </div>
          </div>
          {errors.meetupDescription && <p className="mt-2 text-sm text-status-blocked">{errors.meetupDescription}</p>}
        </div>

        {/* Meetup Website */}
        <div>
          <div className="flex items-end gap-3">
            <div className="flex-1 max-w-[480px]">
              <label className="block text-sm font-medium mb-1.5">
                Meetup Website
              </label>
              <input
                type="url"
                value={config.meetupWebsite}
                onChange={(e) => {
                  setConfig(prev => ({ ...prev, meetupWebsite: e.target.value }));
                  setSaved(prev => ({ ...prev, meetupWebsite: false }));
                }}
                placeholder="https://example.com"
                className={INPUT_CLASS}
              />
            </div>
            <Button
              size="md"
              onClick={() => handleSave("meetupWebsite", config.meetupWebsite)}
              disabled={saving.meetupWebsite}
              className={cn(saved.meetupWebsite && "bg-status-done/15 text-status-done border-status-done/20")}
            >
              {saved.meetupWebsite ? (
                <>
                  <Check className="h-4 w-4" /> Saved
                </>
              ) : saving.meetupWebsite ? (
                "Saving…"
              ) : (
                <>
                  <Save className="h-4 w-4" /> Save
                </>
              )}
            </Button>
          </div>
          {errors.meetupWebsite && <p className="mt-2 text-sm text-status-blocked">{errors.meetupWebsite}</p>}
        </div>

        {/* Past Event Link */}
        <div>
          <div className="flex items-end gap-3">
            <div className="flex-1 max-w-[640px]">
              <label className="block text-sm font-medium mb-1.5">
                Past Event Link
              </label>
              <input
                type="url"
                value={config.meetupPastEventLink}
                onChange={(e) => {
                  setConfig(prev => ({ ...prev, meetupPastEventLink: e.target.value }));
                  setSaved(prev => ({ ...prev, meetupPastEventLink: false }));
                }}
                placeholder="https://example.com/past-events/event-42"
                className={INPUT_CLASS}
              />
            </div>
            <Button
              size="md"
              onClick={() => handleSave("meetupPastEventLink", config.meetupPastEventLink)}
              disabled={saving.meetupPastEventLink}
              className={cn(saved.meetupPastEventLink && "bg-status-done/15 text-status-done border-status-done/20")}
            >
              {saved.meetupPastEventLink ? (
                <>
                  <Check className="h-4 w-4" /> Saved
                </>
              ) : saving.meetupPastEventLink ? (
                "Saving…"
              ) : (
                <>
                  <Save className="h-4 w-4" /> Save
                </>
              )}
            </Button>
          </div>
          {errors.meetupPastEventLink && <p className="mt-2 text-sm text-status-blocked">{errors.meetupPastEventLink}</p>}
        </div>

        {/* Min Event Duration */}
        <div>
          <div className="flex items-end gap-3">
            <div className="flex-1 max-w-[200px]">
              <label className="block text-sm font-medium mb-1.5">
                Minimum Event Duration (hours)
              </label>
              <input
                type="number"
                min={1}
                max={168}
                value={config.minEventDuration}
                onChange={(e) => {
                  setConfig(prev => ({ ...prev, minEventDuration: e.target.value }));
                  setSaved(prev => ({ ...prev, minEventDuration: false }));
                }}
                className={INPUT_CLASS}
              />
            </div>
            <Button
              size="md"
              onClick={() => handleSave('minEventDuration', config.minEventDuration, (v) => setMinEventDuration(parseInt(v, 10)))}
              disabled={saving.minEventDuration}
              className={cn(saved.minEventDuration && "bg-status-done/15 text-status-done border-status-done/20")}
            >
              {saved.minEventDuration ? (
                <>
                  <Check className="h-4 w-4" /> Saved
                </>
              ) : saving.minEventDuration ? (
                "Saving…"
              ) : (
                <>
                  <Save className="h-4 w-4" /> Save
                </>
              )}
            </Button>
          </div>
          {errors.minEventDuration && <p className="mt-2 text-sm text-status-blocked">{errors.minEventDuration}</p>}
        </div>

        {/* Volunteer Promotion Threshold */}
        <div>
          <div className="flex items-end gap-3">
            <div className="flex-1 max-w-[200px]">
              <label className="block text-sm font-medium mb-1.5">
                Volunteer Promotion (min events)
              </label>
              <input
                type="number"
                min={1}
                value={config.volunteerThreshold}
                onChange={(e) => {
                  setConfig(prev => ({ ...prev, volunteerThreshold: e.target.value }));
                  setSaved(prev => ({ ...prev, volunteerThreshold: false }));
                }}
                className={INPUT_CLASS}
              />
            </div>
            <Button
              size="md"
              onClick={() => handleSave('volunteerThreshold', config.volunteerThreshold)}
              disabled={saving.volunteerThreshold}
              className={cn(saved.volunteerThreshold && "bg-status-done/15 text-status-done border-status-done/20")}
            >
              {saved.volunteerThreshold ? (
                <>
                  <Check className="h-4 w-4" /> Saved
                </>
              ) : saving.volunteerThreshold ? (
                "Saving…"
              ) : (
                <>
                  <Save className="h-4 w-4" /> Save
                </>
              )}
            </Button>
          </div>
          {errors.volunteerThreshold && <p className="mt-2 text-sm text-status-blocked">{errors.volunteerThreshold}</p>}
        </div>

        {/* Min Volunteer Tasks */}
        <div>
          <div className="flex items-end gap-3">
            <div className="flex-1 max-w-[200px]">
              <label className="block text-sm font-medium mb-1.5">
                Minimum Volunteer Tasks
              </label>
              <input
                type="number"
                min={1}
                value={config.minVolunteerTasks}
                onChange={(e) => {
                  setConfig(prev => ({ ...prev, minVolunteerTasks: e.target.value }));
                  setSaved(prev => ({ ...prev, minVolunteerTasks: false }));
                }}
                className={INPUT_CLASS}
              />
            </div>
            <Button
              size="md"
              onClick={() => handleSave('minVolunteerTasks', config.minVolunteerTasks, (v) => setMinVolunteerTasks(parseInt(v, 10)))}
              disabled={saving.minVolunteerTasks}
              className={cn(saved.minVolunteerTasks && "bg-status-done/15 text-status-done border-status-done/20")}
            >
              {saved.minVolunteerTasks ? (
                <>
                  <Check className="h-4 w-4" /> Saved
                </>
              ) : saving.minVolunteerTasks ? (
                "Saving…"
              ) : (
                <>
                  <Save className="h-4 w-4" /> Save
                </>
              )}
            </Button>
          </div>
          {errors.minVolunteerTasks && <p className="mt-2 text-sm text-status-blocked">{errors.minVolunteerTasks}</p>}
        </div>

        {/* Group Logo */}
        <div>
          <div className="flex items-start gap-3 mb-4">
            <div className="p-2 rounded-lg bg-accent/10 text-accent">
              <ImagePlus className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-medium mb-1">Group Logo</h4>
              <p className="text-sm text-muted">
                Upload your group&apos;s logo for light and dark themes. The light logo will be used in email headers.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-4">
            {renderUploadZone("logo_light", "Light Logo (for dark backgrounds)", lightPreview, lightInputRef, "bg-gray-900")}
            {renderUploadZone("logo_dark", "Dark Logo (for light backgrounds)", darkPreview, darkInputRef, "bg-gray-100 dark:bg-gray-100")}
          </div>
          {errors.logoUpload && (
            <p className="mt-3 text-sm text-status-blocked">{errors.logoUpload}</p>
          )}
        </div>

        {/* Discord Integration */}
        <div>
          <div className="flex items-start gap-3 mb-4">
            <div className="p-2 rounded-lg bg-accent/10 text-accent">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-medium mb-1 flex items-center gap-2">
                Discord Integration
                <span className="px-2 py-1 text-xs bg-muted/20 text-muted rounded-md">Coming Soon</span>
              </h4>
              <p className="text-sm text-muted">
                Bot and notification channels will be configurable here in a future release.
              </p>
            </div>
          </div>
          <div className="p-4 bg-muted/10 border border-dashed border-muted/30 rounded-lg">
            <p className="text-sm text-muted text-center">
              Discord integration settings will be available here soon
            </p>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}

function MeetupNameCard() {
  const { meetupName, setMeetupName } = useAppSettings();
  const [name, setName] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(meetupName);
  }, [meetupName]);

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Meetup name cannot be empty");
      return;
    }
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "meetup_name", value: trimmed }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to save");
      }
      setMeetupName(trimmed);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-surface border border-border rounded-xl p-6">
      <div className="flex items-start gap-3 mb-4">
        <div className="p-2 rounded-lg bg-accent/10 text-accent">
          <Type className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-semibold mb-1">Meetup Name</h3>
          <p className="text-sm text-muted">
            Set the name of your meetup group. This will be displayed in the sidebar and toolbar.
          </p>
        </div>
      </div>
      <div className="flex items-end gap-3">
        <div className="flex-1 max-w-[320px]">
          <label className="block text-sm font-medium mb-1.5">
            Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setSaved(false);
            }}
            placeholder="e.g. React Bangalore"
            className={INPUT_CLASS}
          />
        </div>
        <Button
          size="md"
          onClick={handleSave}
          disabled={saving}
          className={cn(saved && "bg-status-done/15 text-status-done border-status-done/20")}
        >
          {saved ? (
            <>
              <Check className="h-4 w-4" /> Saved
            </>
          ) : saving ? (
            "Saving…"
          ) : (
            <>
              <Save className="h-4 w-4" /> Save
            </>
          )}
        </Button>
      </div>
      {error && (
        <p className="mt-2 text-sm text-status-blocked">{error}</p>
      )}
    </div>
  );
}

function VolunteerThresholdCard() {
  const [threshold, setThreshold] = useState("5");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : {}))
      .then((data: Record<string, string>) => {
        if (data.volunteer_promotion_threshold) {
          setThreshold(data.volunteer_promotion_threshold);
        }
      })
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    const num = parseInt(threshold, 10);
    if (isNaN(num) || num < 1) {
      setError("Must be a number greater than 0");
      return;
    }
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "volunteer_promotion_threshold", value: String(num) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to save");
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-surface border border-border rounded-xl p-6">
      <div className="flex items-start gap-3 mb-4">
        <div className="p-2 rounded-lg bg-accent/10 text-accent">
          <Users className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-semibold mb-1">Volunteer Promotion</h3>
          <p className="text-sm text-muted">
            Set the minimum number of event contributions required before a volunteer
            becomes eligible for conversion to a member.
          </p>
        </div>
      </div>
      <div className="flex items-end gap-3">
        <div className="flex-1 max-w-[200px]">
          <label className="block text-sm font-medium mb-1.5">
            Minimum Events
          </label>
          <input
            type="number"
            min={1}
            value={threshold}
            onChange={(e) => {
              setThreshold(e.target.value);
              setSaved(false);
            }}
            className={INPUT_CLASS}
          />
        </div>
        <Button
          size="md"
          onClick={handleSave}
          disabled={saving}
          className={cn(saved && "bg-status-done/15 text-status-done border-status-done/20")}
        >
          {saved ? (
            <>
              <Check className="h-4 w-4" /> Saved
            </>
          ) : saving ? (
            "Saving…"
          ) : (
            <>
              <Save className="h-4 w-4" /> Save
            </>
          )}
        </Button>
      </div>
      {error && (
        <p className="mt-2 text-sm text-status-blocked">{error}</p>
      )}
    </div>
  );
}

function MinVolunteerTasksCard() {
  const { minVolunteerTasks, setMinVolunteerTasks } = useAppSettings();
  const [value, setValue] = useState("7");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setValue(String(minVolunteerTasks));
  }, [minVolunteerTasks]);

  const handleSave = async () => {
    const num = parseInt(value, 10);
    if (isNaN(num) || num < 1) {
      setError("Must be a number greater than 0");
      return;
    }
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "min_volunteer_tasks", value: String(num) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to save");
      }
      setMinVolunteerTasks(num);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-surface border border-border rounded-xl p-6">
      <div className="flex items-start gap-3 mb-4">
        <div className="p-2 rounded-lg bg-accent/10 text-accent">
          <ClipboardCheck className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-semibold mb-1">Minimum Volunteer Tasks</h3>
          <p className="text-sm text-muted">
            Set the minimum number of completed SOP tasks required per volunteer
            for each event. Displayed as a progress badge on the volunteer tab.
          </p>
        </div>
      </div>
      <div className="flex items-end gap-3">
        <div className="flex-1 max-w-[200px]">
          <label className="block text-sm font-medium mb-1.5">
            Minimum Tasks
          </label>
          <input
            type="number"
            min={1}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setSaved(false);
            }}
            className={INPUT_CLASS}
          />
        </div>
        <Button
          size="md"
          onClick={handleSave}
          disabled={saving}
          className={cn(saved && "bg-status-done/15 text-status-done border-status-done/20")}
        >
          {saved ? (
            <>
              <Check className="h-4 w-4" /> Saved
            </>
          ) : saving ? (
            "Saving…"
          ) : (
            <>
              <Save className="h-4 w-4" /> Save
            </>
          )}
        </Button>
      </div>
      {error && (
        <p className="mt-2 text-sm text-status-blocked">{error}</p>
      )}
    </div>
  );
}

const EMAIL_TEMPLATE_OPTIONS = [
  { value: "test", label: "Basic Test Email" },
  { value: "member-invitation", label: "Member Invitation" },
  { value: "volunteer-welcome", label: "Volunteer Welcome" },
  { value: "volunteer-promotion", label: "Volunteer Promotion" },
  { value: "event-created", label: "Event Created" },
  { value: "event-reminder", label: "Event Reminder" },
  { value: "task-assigned", label: "Task Assigned" },
  { value: "task-due-soon", label: "Task Due Soon" },
  { value: "task-overdue", label: "Task Overdue" },
  { value: "speaker-invitation", label: "Speaker Invitation" },
  { value: "venue-confirmed", label: "Venue Confirmed" },
  { value: "weekly-digest", label: "Weekly Digest" },
] as const;

function TestEmailCard() {
  const [email, setEmail] = useState("");
  const [template, setTemplate] = useState("test");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [smtpStatus, setSmtpStatus] = useState<{
    configured: boolean;
    connected: boolean;
    error?: string;
  } | null>(null);

  useEffect(() => {
    fetch("/api/email/test")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setSmtpStatus(data);
      })
      .catch(() => {});
  }, []);

  const handleSend = async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      setResult({ success: false, message: "Please enter an email address" });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setResult({ success: false, message: "Invalid email address format" });
      return;
    }
    setSending(true);
    setResult(null);
    try {
      const res = await fetch("/api/email/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed, template }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const templateLabel = EMAIL_TEMPLATE_OPTIONS.find((t) => t.value === template)?.label ?? "Test";
        setResult({ success: true, message: `"${templateLabel}" email sent to ${data.sentTo}` });
        setEmail("");
      } else {
        setResult({ success: false, message: data.error ?? "Failed to send" });
      }
    } catch {
      setResult({ success: false, message: "Network error — could not reach server" });
    } finally {
      setSending(false);
    }
  };

  const smtpOk = smtpStatus?.configured && smtpStatus?.connected;

  return (
    <div className="bg-surface border border-border rounded-xl p-6">
      <div className="flex items-start gap-3 mb-4">
        <div className="p-2 rounded-lg bg-accent/10 text-accent">
          <Mail className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-semibold mb-1">Test Email</h3>
          <p className="text-sm text-muted">
            Send a test email to verify your SMTP configuration and preview any
            email template. Select a template and enter a recipient below.
          </p>
        </div>
      </div>
      {smtpStatus && !smtpOk && (
        <div className="flex items-center gap-2 mb-4 text-sm text-status-blocked bg-status-blocked/10 rounded-lg px-3 py-2">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>
            {!smtpStatus.configured
              ? "SMTP is not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS in your .env file."
              : `SMTP connection failed: ${smtpStatus.error}`}
          </span>
        </div>
      )}
      {smtpStatus && smtpOk && (
        <div className="flex items-center gap-2 mb-4 text-sm text-status-done bg-status-done/10 rounded-lg px-3 py-2">
          <Check className="h-4 w-4 flex-shrink-0" />
          <span>SMTP connected and ready</span>
        </div>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1 max-w-[240px]">
          <label className="block text-sm font-medium mb-1.5">
            Email Template
          </label>
          <div className="relative">
            <select
              value={template}
              onChange={(e) => {
                setTemplate(e.target.value);
                setResult(null);
              }}
              className={cn(INPUT_CLASS, "appearance-none pr-8 cursor-pointer")}
            >
              {EMAIL_TEMPLATE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
          </div>
        </div>
        <div className="flex-1 max-w-[280px]">
          <label className="block text-sm font-medium mb-1.5">
            Recipient Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setResult(null);
            }}
            placeholder="member@example.com"
            className={INPUT_CLASS}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !sending) handleSend();
            }}
          />
        </div>
        <Button
          size="md"
          onClick={handleSend}
          disabled={sending || (smtpStatus !== null && !smtpOk)}
        >
          {sending ? (
            "Sending…"
          ) : (
            <>
              <Send className="h-4 w-4" /> Send Test
            </>
          )}
        </Button>
      </div>
      {result && (
        <p
          className={cn(
            "mt-2 text-sm",
            result.success ? "text-status-done" : "text-status-blocked"
          )}
        >
          {result.message}
        </p>
      )}
    </div>
  );
}

function LogoUploadCard() {
  const { logoLight, setLogoLight, logoDark, setLogoDark } = useAppSettings();
  const [lightPreview, setLightPreview] = useState<string | null>(null);
  const [darkPreview, setDarkPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lightInputRef = useRef<HTMLInputElement>(null);
  const darkInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLightPreview(logoLight);
  }, [logoLight]);

  useEffect(() => {
    setDarkPreview(logoDark);
  }, [logoDark]);

  const MAX_SIZE = 200 * 1024; // 200KB
  const ACCEPT = "image/png,image/jpeg,image/svg+xml,image/webp";

  const handleFile = (file: File, variant: "logo_light" | "logo_dark") => {
    if (file.size > MAX_SIZE) {
      setError(`Image too large (${(file.size / 1024).toFixed(0)}KB). Max 200KB.`);
      return;
    }
    if (!["image/png", "image/jpeg", "image/svg+xml", "image/webp"].includes(file.type)) {
      setError("Only PNG, JPEG, SVG, and WebP images are supported.");
      return;
    }
    setError(null);

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUri = reader.result as string;

      if (variant === "logo_light") setLightPreview(dataUri);
      else setDarkPreview(dataUri);

      setSaving(variant);
      setSaved(null);
      try {
        const res = await fetch("/api/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: variant, value: dataUri }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "Failed to save");
        }
        if (variant === "logo_light") setLogoLight(dataUri);
        else setLogoDark(dataUri);
        setSaved(variant);
        setTimeout(() => setSaved(null), 2000);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to save");
        if (variant === "logo_light") setLightPreview(logoLight);
        else setDarkPreview(logoDark);
      } finally {
        setSaving(null);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemove = async (variant: "logo_light" | "logo_dark") => {
    setSaving(variant);
    setError(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: variant, value: "" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to remove");
      }
      if (variant === "logo_light") {
        setLogoLight(null);
        setLightPreview(null);
      } else {
        setLogoDark(null);
        setDarkPreview(null);
      }
      setSaved(variant);
      setTimeout(() => setSaved(null), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to remove");
    } finally {
      setSaving(null);
    }
  };

  const renderUploadZone = (
    variant: "logo_light" | "logo_dark",
    label: string,
    preview: string | null,
    inputRef: React.RefObject<HTMLInputElement | null>,
    bgClass: string
  ) => (
    <div className="flex-1 min-w-[200px]">
      <label className="block text-sm font-medium mb-1.5">{label}</label>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file, variant);
          e.target.value = "";
        }}
      />
      {preview ? (
        <div className={cn("relative rounded-lg border border-border p-4 flex items-center gap-4", bgClass)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt={label}
            className="h-12 w-12 object-contain rounded"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="text-xs px-3 py-1.5 rounded-md border border-border bg-surface hover:bg-surface-hover transition-colors"
              disabled={saving === variant}
            >
              Replace
            </button>
            <button
              type="button"
              onClick={() => handleRemove(variant)}
              className="text-xs px-3 py-1.5 rounded-md border border-status-blocked/30 text-status-blocked hover:bg-status-blocked/10 transition-colors"
              disabled={saving === variant}
            >
              Remove
            </button>
          </div>
          {saving === variant && (
            <span className="text-xs text-muted ml-auto">Saving…</span>
          )}
          {saved === variant && (
            <span className="text-xs text-status-done ml-auto flex items-center gap-1">
              <Check className="h-3 w-3" /> Saved
            </span>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={cn(
            "w-full rounded-lg border-2 border-dashed border-border p-6 flex flex-col items-center gap-2 hover:border-accent/50 hover:bg-accent/5 transition-colors cursor-pointer",
            bgClass
          )}
          disabled={saving === variant}
        >
          <ImagePlus className="h-6 w-6 text-muted" />
          <span className="text-sm text-muted">
            {saving === variant ? "Uploading…" : "Click to upload"}
          </span>
          <span className="text-xs text-muted/60">PNG, JPEG, SVG, WebP · Max 200KB</span>
        </button>
      )}
    </div>
  );

  return (
    <div className="bg-surface border border-border rounded-xl p-6">
      <div className="flex items-start gap-3 mb-4">
        <div className="p-2 rounded-lg bg-accent/10 text-accent">
          <ImagePlus className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-semibold mb-1">Group Logo</h3>
          <p className="text-sm text-muted">
            Upload your group&apos;s logo for light and dark themes. The light logo will be used in email headers.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-4">
        {renderUploadZone("logo_light", "Light Logo (for dark backgrounds)", lightPreview, lightInputRef, "bg-gray-900")}
        {renderUploadZone("logo_dark", "Dark Logo (for light backgrounds)", darkPreview, darkInputRef, "bg-gray-100 dark:bg-gray-100")}
      </div>
      {error && (
        <p className="mt-3 text-sm text-status-blocked">{error}</p>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const { data: session } = useSession();
  const role = session?.user?.globalRole;
  const isAdmin = role === "ADMIN" || role === "SUPER_ADMIN";
  const isSuperAdmin = role === "SUPER_ADMIN";

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Settings"
        description="Configure your workspace"
      />
      <div className="space-y-6">
        <Link href="/settings/members" className="block mb-4">
          <div className="bg-surface border border-border rounded-xl p-6 hover:bg-surface-hover transition-colors">
            <h3 className="font-semibold mb-1">Members</h3>
            <p className="text-sm text-muted">User roles and permissions</p>
          </div>
        </Link>
        {isAdmin && (
          <Link href="/settings/audit-log" className="block mb-4">
            <div className="bg-surface border border-border rounded-xl p-6 hover:bg-surface-hover transition-colors">
              <h3 className="font-semibold mb-1">Audit Log</h3>
              <p className="text-sm text-muted">Track changes across your workspace</p>
            </div>
          </Link>
        )}
        <div className="mt-4">
          {isSuperAdmin && <AppConfigCard />}
        </div>
        {isAdmin && <TestEmailCard />}
      </div>
    </div>
  );
}
