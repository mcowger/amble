import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTime(dateString?: string): string {
  if (!dateString) return "";
  try {
    const d = new Date(dateString);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export function formatDate(dateString?: string): string {
  if (!dateString) return "";
  try {
    const d = new Date(dateString);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) return "Today";
    
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";

    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

export function formatTokens(count?: number): string {
  if (!count) return "0";
  if (count < 1000) return `${count}`;
  if (count < 1000000) return `${(count / 1000).toFixed(1)}k`;
  return `${(count / 1000000).toFixed(2)}m`;
}

export function formatDuration(ms?: number): string {
  if (!ms || ms < 0) return "0s";
  if (ms < 1000) return `${ms}ms`;
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  const remSec = sec % 60;
  return `${min}m ${remSec}s`;
}
