import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type NoticeTone = "info" | "warning" | "error" | "success";

const toneClasses: Record<NoticeTone, string> = {
  info: "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  warning:
    "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  error: "border-red-300 bg-red-50 text-red-800 dark:border-red-700 dark:bg-red-950/40 dark:text-red-300",
  success:
    "border-green-300 bg-green-50 text-green-800 dark:border-green-700 dark:bg-green-950/40 dark:text-green-300",
};

export interface NoticeBannerProps {
  title: string;
  tone: NoticeTone;
  children: ReactNode;
}

export function NoticeBanner({ title, tone, children }: NoticeBannerProps): JSX.Element {
  return (
    <section className={cn("grid gap-2 rounded-xl border p-3.5", toneClasses[tone])}>
      <strong>{title}</strong>
      <div>{children}</div>
    </section>
  );
}
