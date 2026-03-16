import type { PlatformGuidanceCard } from "../../types/installWizard";

export interface PlatformGuidancePanelProps {
  cards: PlatformGuidanceCard[];
}

export function PlatformGuidancePanel({ cards }: PlatformGuidancePanelProps): JSX.Element {
  return (
    <section
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: 12,
        background: "#ffffff",
        padding: 16,
        display: "grid",
        gap: 12,
      }}
    >
      <div>
        <h3 style={{ margin: 0 }}>Platform Guidance</h3>
        <p style={{ margin: "6px 0 0", color: "#64748b" }}>
          Windows、macOS 和 Linux 使用同一条产品链路，但命令路径、权限模型和排障重点不同。
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
        {cards.map((card) => (
          <article
            key={card.platform}
            style={{
              border: card.isCurrent ? "1px solid #93c5fd" : "1px solid #e2e8f0",
              borderRadius: 12,
              background: card.isCurrent ? "#f8fbff" : "#ffffff",
              padding: 14,
              display: "grid",
              gap: 8,
              boxShadow: card.isCurrent ? "0 0 0 1px rgba(147, 197, 253, 0.2)" : "none",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
              <strong>{card.title}</strong>
              {card.isCurrent ? (
                <span
                  style={{
                    borderRadius: 999,
                    padding: "4px 10px",
                    fontSize: 12,
                    fontWeight: 700,
                    background: "#dbeafe",
                    color: "#1d4ed8",
                  }}
                >
                  Current
                </span>
              ) : null}
            </div>
            <p style={{ margin: 0, color: "#475569" }}>
              <strong>Install:</strong> {card.installSource}
            </p>
            <p style={{ margin: 0, color: "#475569" }}>
              <strong>Path Hint:</strong> {card.pathHint}
            </p>
            <p style={{ margin: 0, color: "#64748b", fontSize: 13 }}>{card.troubleshooting}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
