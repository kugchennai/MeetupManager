import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string, timeZone?: string) {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone,
  });
}

export function formatDateTime(date: Date | string, timeZone?: string) {
  return new Date(date).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
    timeZoneName: "short",
  });
}

/**
 * Format a start–end date/time range.
 * Same day:  "Mar 1, 2026, 10:00 AM – 12:30 PM"
 * Different days: "Mar 1, 2026, 10:00 AM – Mar 2, 2026, 12:30 PM"
 */
export function formatDateTimeRange(start: Date | string, end: Date | string, timeZone?: string) {
  const s = new Date(start);
  const e = new Date(end);

  // To strictly check if it's the same day in target timezone, 
  // we can compare the date string formatted in that timezone.
  const sDateStr = s.toLocaleDateString("en-US", { timeZone });
  const eDateStr = e.toLocaleDateString("en-US", { timeZone });
  const sameDay = sDateStr === eDateStr;

  if (sameDay) {
    const datePart = s.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone,
    });
    const startTime = s.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone,
    });
    const endTime = e.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone,
      timeZoneName: "short",
    });
    return `${datePart}, ${startTime} – ${endTime}`;
  }

  return `${formatDateTime(s, timeZone)} – ${formatDateTime(e, timeZone)}`;
}

export function formatRelativeDate(date: Date | string) {
  const now = new Date();
  const target = new Date(date);
  const diffMs = target.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays === -1) return "Yesterday";
  if (diffDays > 0) return `${diffDays} days away`;
  return `${Math.abs(diffDays)} days ago`;
}

export function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function formatTimeAgo(date: Date | string) {
  const now = new Date();
  const target = new Date(date);
  const diffMs = now.getTime() - target.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHr / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? "" : "s"} ago`;
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? "" : "s"} ago`;
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return formatDate(date);
}
