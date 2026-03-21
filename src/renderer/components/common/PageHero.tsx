import type { ReactNode } from "react";

export interface PageHeroProps {
  title: string;
  description: string;
  meta?: string;
  action?: ReactNode;
}

export function PageHero({ title, description, meta, action }: PageHeroProps): JSX.Element {
  return (
    <header
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 16,
        alignItems: "flex-start",
        flexWrap: "wrap",
      }}
    >
      <div style={{ display: "grid", gap: 8 }}>
        <h2 style={{ margin: 0 }}>{title}</h2>
        <p style={{ margin: 0, color: "#64748b", maxWidth: 860 }}>{description}</p>
        {meta ? <p style={{ margin: 0, fontSize: 13, color: "#94a3b8" }}>{meta}</p> : null}
      </div>
      {action}
    </header>
  );
}
