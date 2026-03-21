import type { ReactNode } from "react";

export type NoticeTone = "info" | "warning" | "error" | "success";

const toneMap: Record<NoticeTone, { border: string; bg: string; text: string }> = {
  info: { border: "#93c5fd", bg: "#eff6ff", text: "#1d4ed8" },
  warning: { border: "#fcd34d", bg: "#fffbeb", text: "#92400e" },
  error: { border: "#fca5a5", bg: "#fef2f2", text: "#991b1b" },
  success: { border: "#86efac", bg: "#f0fdf4", text: "#166534" },
};

export interface NoticeBannerProps {
  title: string;
  tone: NoticeTone;
  children: ReactNode;
}

export function NoticeBanner({ title, tone, children }: NoticeBannerProps): JSX.Element {
  const style = toneMap[tone];
  return (
    <section
      style={{
        border: `1px solid ${style.border}`,
        borderRadius: 12,
        background: style.bg,
        color: style.text,
        padding: 14,
        display: "grid",
        gap: 8,
      }}
    >
      <strong>{title}</strong>
      <div>{children}</div>
    </section>
  );
}
