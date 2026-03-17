import type { CSSProperties, ReactNode } from "react";

export interface SurfaceCardProps {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  style?: CSSProperties;
}

export function SurfaceCard({
  title,
  subtitle,
  action,
  children,
  style,
}: SurfaceCardProps): JSX.Element {
  return (
    <section
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: 14,
        background: "#ffffff",
        padding: 16,
        display: "grid",
        gap: 14,
        ...style,
      }}
    >
      {title || subtitle || action ? (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
            alignItems: "flex-start",
          }}
        >
          <div style={{ display: "grid", gap: 6 }}>
            {title ? <h3 style={{ margin: 0, color: "#0f172a" }}>{title}</h3> : null}
            {subtitle ? <p style={{ margin: 0, color: "#64748b" }}>{subtitle}</p> : null}
          </div>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}
