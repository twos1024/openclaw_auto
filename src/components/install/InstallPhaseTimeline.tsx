import type { InstallPhase, InstallPhaseStatus } from "../../types/install";

const statusStyles: Record<InstallPhaseStatus, { bg: string; color: string; border: string }> = {
  success: { bg: "#f0fdf4", color: "#166534", border: "#86efac" },
  warning: { bg: "#fffbeb", color: "#92400e", border: "#fcd34d" },
  failure: { bg: "#fef2f2", color: "#991b1b", border: "#fca5a5" },
  pending: { bg: "#f8fafc", color: "#475569", border: "#cbd5e1" },
  running: { bg: "#eff6ff", color: "#1d4ed8", border: "#93c5fd" },
};

const statusLabels: Record<InstallPhaseStatus, string> = {
  success: "完成",
  warning: "注意",
  failure: "失败",
  pending: "等待中",
  running: "进行中",
};

function StatusBadge({ status }: { status: InstallPhaseStatus }): JSX.Element {
  const style = statusStyles[status];
  return (
    <span
      style={{
        borderRadius: 999,
        padding: "2px 8px",
        fontSize: 12,
        fontWeight: 700,
        background: style.bg,
        color: style.color,
        border: `1px solid ${style.border}`,
      }}
    >
      {statusLabels[status]}
    </span>
  );
}

export interface InstallPhaseTimelineProps {
  phases: InstallPhase[];
  activePhaseId?: InstallPhase["id"] | null;
}

export function InstallPhaseTimeline({ phases, activePhaseId = null }: InstallPhaseTimelineProps): JSX.Element {
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
        <h3 style={{ margin: 0 }}>安装阶段</h3>
        <p style={{ margin: "6px 0 0", color: "#64748b" }}>
          按照环境检查、CLI 安装、Gateway 安装和验证四个阶段展示当前进度。
        </p>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {phases.map((phase, index) => (
          <article
            key={phase.id}
            style={{
              border:
                phase.id === activePhaseId || phase.status === "running"
                  ? "1px solid #93c5fd"
                  : "1px solid #e2e8f0",
              borderRadius: 10,
              padding: 12,
              display: "grid",
              gap: 8,
              background:
                phase.id === activePhaseId || phase.status === "running" ? "#f8fbff" : "#ffffff",
              boxShadow:
                phase.id === activePhaseId || phase.status === "running"
                  ? "0 0 0 1px rgba(147, 197, 253, 0.25)"
                  : "none",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
              <strong style={{ color: "#0f172a" }}>
                {index + 1}. {phase.title}
              </strong>
              <StatusBadge status={phase.status} />
            </div>
            <p style={{ margin: 0, color: "#334155" }}>{phase.detail}</p>
            <p style={{ margin: 0, fontSize: 13, color: "#475569" }}>建议：{phase.suggestion}</p>
            {phase.code ? (
              <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>错误码：{phase.code}</p>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
