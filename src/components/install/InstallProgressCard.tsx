import type { InstallPhaseId, InstallProgressModel } from "../../types/install";

const toneStyles = {
  idle: { bg: "#ffffff", border: "#e2e8f0", fill: "#94a3b8", accent: "#475569" },
  running: { bg: "#f8fbff", border: "#bfdbfe", fill: "#2563eb", accent: "#1d4ed8" },
  success: { bg: "#f0fdf4", border: "#86efac", fill: "#16a34a", accent: "#166534" },
  warning: { bg: "#fffbeb", border: "#fcd34d", fill: "#d97706", accent: "#92400e" },
  failure: { bg: "#fef2f2", border: "#fca5a5", fill: "#dc2626", accent: "#991b1b" },
  blocked: { bg: "#fff7ed", border: "#fdba74", fill: "#ea580c", accent: "#9a3412" },
} as const;

const phaseTitles: Record<InstallPhaseId, string> = {
  prerequisite: "环境检查",
  "install-cli": "安装 OpenClaw CLI",
  "install-gateway": "安装 Gateway 托管服务",
  verify: "结果验证",
};

export interface InstallProgressCardProps {
  progress: InstallProgressModel;
}

export function InstallProgressCard({ progress }: InstallProgressCardProps): JSX.Element | null {
  if (!progress.visible) {
    return null;
  }

  const style = toneStyles[progress.tone];

  return (
    <section
      aria-live="polite"
      style={{
        border: `1px solid ${style.border}`,
        borderRadius: 12,
        background: style.bg,
        padding: 16,
        display: "grid",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}>
        <div style={{ display: "grid", gap: 6 }}>
          <h3 style={{ margin: 0 }}>安装进度</h3>
          <strong style={{ color: style.accent }}>{progress.headline}</strong>
          <p style={{ margin: 0, color: "#334155" }}>{progress.detail}</p>
        </div>
        <div
          style={{
            minWidth: 68,
            textAlign: "right",
            fontWeight: 700,
            color: style.accent,
          }}
        >
          {progress.percent}%
        </div>
      </div>

      <div
        role="progressbar"
        aria-label="安装进度"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress.percent}
        style={{
          width: "100%",
          height: 12,
          borderRadius: 999,
          background: "#e2e8f0",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${progress.percent}%`,
            height: "100%",
            borderRadius: 999,
            background: style.fill,
            transition: "width 220ms ease",
          }}
        />
      </div>

      <div style={{ display: "grid", gap: 4 }}>
        <p style={{ margin: 0, fontSize: 13, color: "#475569" }}>
          当前阶段：{progress.activePhaseId ? phaseTitles[progress.activePhaseId] : "等待开始"}
        </p>
        <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>{progress.hint}</p>
      </div>
    </section>
  );
}
