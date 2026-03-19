import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function timeBucket(isoOrMs: string | number): "today" | "yesterday" | "thisWeek" | "thisMonth" | "older" {
  const ms = typeof isoOrMs === "number" ? isoOrMs : new Date(isoOrMs).getTime();
  const now = Date.now();
  const d = now - ms;
  const DAY = 86_400_000;
  if (d < DAY) return "today";
  if (d < 2 * DAY) return "yesterday";
  if (d < 7 * DAY) return "thisWeek";
  if (d < 30 * DAY) return "thisMonth";
  return "older";
}

export const BUCKET_LABELS: Record<ReturnType<typeof timeBucket>, string> = {
  today: "今天",
  yesterday: "昨天",
  thisWeek: "本周",
  thisMonth: "本月",
  older: "更早",
};
