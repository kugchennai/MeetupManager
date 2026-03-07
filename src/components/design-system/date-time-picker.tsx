"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addMonths,
  subMonths,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  isBefore,
  startOfDay,
} from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";
import { Calendar, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface DateTimePickerProps {
  value: string; // ISO or datetime-local format
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  className?: string;
  minDateTime?: string; // Minimum allowed date/time in ISO format
  timeZone?: string;
}

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export function DateTimePicker({
  value,
  onChange,
  required,
  placeholder = "Pick a date & time",
  className,
  minDateTime,
  timeZone,
}: DateTimePickerProps) {
  const selectedDate = value ? (timeZone ? toZonedTime(new Date(value), timeZone) : new Date(value)) : null;

  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => {
    if (selectedDate) return startOfMonth(selectedDate);
    return startOfMonth(timeZone ? toZonedTime(new Date(), timeZone) : new Date());
  });
  const containerRef = useRef<HTMLDivElement>(null);

  const [hour, setHour] = useState(() =>
    selectedDate ? selectedDate.getHours() : 10
  );
  const [minute, setMinute] = useState(() =>
    selectedDate ? selectedDate.getMinutes() : 0
  );

  // Sync time fields when value changes externally
  useEffect(() => {
    if (value) {
      const d = timeZone ? toZonedTime(new Date(value), timeZone) : new Date(value);
      setHour(d.getHours());
      setMinute(d.getMinutes());
    }
  }, [value, timeZone]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  const emitValue = useCallback(
    (date: Date, h: number, m: number) => {
      const pad = (n: number) => String(n).padStart(2, "0");
      const localStr = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(h)}:${pad(m)}:00`;

      if (timeZone) {
        onChange(fromZonedTime(localStr, timeZone).toISOString());
      } else {
        const d = new Date(date);
        d.setHours(h, m, 0, 0);
        onChange(d.toISOString());
      }
    },
    [onChange, timeZone]
  );

  const handleDayClick = (day: Date) => {
    emitValue(day, hour, minute);
  };

  const handleHourChange = (h: number) => {
    setHour(h);
    if (selectedDate) emitValue(selectedDate, h, minute);
  };

  const handleMinuteChange = (m: number) => {
    setMinute(m);
    if (selectedDate) emitValue(selectedDate, hour, m);
  };

  // Build calendar grid
  const monthStart = startOfMonth(viewDate);
  const monthEnd = endOfMonth(viewDate);
  const calStart = startOfWeek(monthStart);
  const calEnd = endOfWeek(monthEnd);
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  const today = startOfDay(new Date());
  const minDateTimeObj = minDateTime ? new Date(minDateTime) : null;
  const minDateOnly = minDateTimeObj ? startOfDay(minDateTimeObj) : null;

  // Helper to check if a date/time combination is valid
  const isDateTimeValid = (date: Date, h: number, m: number) => {
    if (!minDateTimeObj) return true;

    let candidateIso = "";
    const pad = (n: number) => String(n).padStart(2, "0");
    const localStr = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(h)}:${pad(m)}:00`;

    if (timeZone) {
      candidateIso = fromZonedTime(localStr, timeZone).toISOString();
    } else {
      const d = new Date(date);
      d.setHours(h, m, 0, 0);
      candidateIso = d.toISOString();
    }
    return new Date(candidateIso) >= minDateTimeObj;
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "w-full flex items-center gap-2.5 bg-background border border-border rounded-lg px-3.5 py-2.5 text-sm text-left",
          "hover:border-border-hover focus:border-accent focus:ring-1 focus:ring-accent/30 outline-none transition-all",
          !selectedDate && "text-muted/50"
        )}
      >
        <Calendar className="h-4 w-4 text-muted shrink-0" />
        <span className="flex-1 truncate">
          {selectedDate
            ? format(selectedDate, "EEE, MMM d, yyyy · h:mm a") + (timeZone ? ` (${Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "short" }).formatToParts(new Date()).find(p => p.type === "timeZoneName")?.value || ""})` : "")
            : placeholder}
        </span>
      </button>

      {/* Hidden native input for form validation */}
      {required && (
        <input
          type="text"
          required
          value={value}
          onChange={() => { }}
          className="sr-only"
          tabIndex={-1}
          aria-hidden
        />
      )}

      {/* Popover */}
      {open && (
        <div
          className={cn(
            "absolute z-50 mt-2 left-0 w-[320px]",
            "bg-surface border border-border rounded-xl shadow-2xl shadow-black/20",
            "animate-fade-in"
          )}
        >
          {/* Calendar header */}
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <button
              type="button"
              onClick={() => setViewDate((d) => subMonths(d, 1))}
              className="h-7 w-7 flex items-center justify-center rounded-lg text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold text-foreground">
              {format(viewDate, "MMMM yyyy")}
            </span>
            <button
              type="button"
              onClick={() => setViewDate((d) => addMonths(d, 1))}
              className="h-7 w-7 flex items-center justify-center rounded-lg text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 px-3">
            {WEEKDAYS.map((wd) => (
              <div
                key={wd}
                className="h-8 flex items-center justify-center text-[11px] font-semibold uppercase tracking-wider text-muted"
              >
                {wd}
              </div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 px-3 pb-3">
            {days.map((day) => {
              const inMonth = isSameMonth(day, viewDate);
              const selected = selectedDate && isSameDay(day, selectedDate);
              const todayMark = isToday(day);
              const past = isBefore(day, today);
              const beforeMin = minDateOnly && isBefore(day, minDateOnly);
              const disabled = past || beforeMin;

              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  disabled={!!disabled}
                  onClick={() => handleDayClick(day)}
                  className={cn(
                    "h-9 w-full flex items-center justify-center rounded-lg text-sm transition-all relative",
                    !inMonth && "text-muted/30",
                    inMonth && !selected && !disabled && "text-foreground hover:bg-surface-hover",
                    inMonth && disabled && "text-muted/30 cursor-not-allowed",
                    selected &&
                    "bg-accent text-accent-fg font-semibold shadow-sm shadow-accent/25",
                    todayMark && !selected && inMonth && "font-semibold"
                  )}
                >
                  {format(day, "d")}
                  {todayMark && !selected && (
                    <span className="absolute bottom-1 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-accent" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Divider */}
          <div className="border-t border-border mx-3" />

          {/* Time picker */}
          <div className="flex items-center gap-3 px-4 py-3">
            <Clock className="h-4 w-4 text-muted shrink-0" />
            <span className="text-xs font-semibold uppercase tracking-wide text-muted">
              Time
            </span>
            <div className="ml-auto flex items-center gap-1.5">
              <select
                value={hour}
                onChange={(e) => handleHourChange(Number(e.target.value))}
                className="bg-background border border-border rounded-lg px-2 py-1.5 text-sm text-foreground focus:border-accent outline-none transition-all cursor-pointer appearance-none text-center w-[52px]"
              >
                {Array.from({ length: 24 }, (_, i) => {
                  const isDisabled = selectedDate && !isDateTimeValid(selectedDate, i, minute);
                  return (
                    <option key={i} value={i} disabled={!!isDisabled}>
                      {String(i).padStart(2, "0")}
                    </option>
                  );
                })}
              </select>
              <span className="text-sm font-bold text-muted">:</span>
              <select
                value={minute}
                onChange={(e) => handleMinuteChange(Number(e.target.value))}
                className="bg-background border border-border rounded-lg px-2 py-1.5 text-sm text-foreground focus:border-accent outline-none transition-all cursor-pointer appearance-none text-center w-[52px]"
              >
                {Array.from({ length: 12 }, (_, i) => i * 5).map((m) => {
                  const isDisabled = selectedDate && !isDateTimeValid(selectedDate, hour, m);
                  return (
                    <option key={m} value={m} disabled={!!isDisabled}>
                      {String(m).padStart(2, "0")}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          {/* Quick actions */}
          <div className="border-t border-border px-4 py-2.5 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                const now = timeZone ? toZonedTime(new Date(), timeZone) : new Date();
                setViewDate(startOfMonth(now));
                handleDayClick(now);
              }}
              className="text-xs font-medium text-accent hover:underline transition-colors"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs font-medium text-foreground bg-surface-hover hover:bg-surface-active px-3 py-1.5 rounded-lg transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
