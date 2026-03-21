import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { InstallEnvironment } from "../../types/install";

function EnvRow(props: { label: string; value: string | null | undefined }): JSX.Element {
  return (
    <p style={{ margin: 0, color: "#334155" }}>
      <strong>{props.label}:</strong> {props.value && props.value.trim() ? props.value : "-"}
    </p>
  );
}

function StatusPill(props: { label: string; ok: boolean }): JSX.Element {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: 999,
        padding: "4px 10px",
        fontSize: 12,
        fontWeight: 700,
        color: props.ok ? "#166534" : "#991b1b",
        background: props.ok ? "#dcfce7" : "#fee2e2",
      }}
    >
      {props.label}
    </span>
  );
}

export interface InstallEnvironmentPanelProps {
  environment: InstallEnvironment | null;
  isLoading: boolean;
  isInstalling: boolean;
  runtimeBlockMode: "preview" | "runtime-unavailable" | null;
  onRefresh: () => void;
  onInstall: () => void;
}

export function InstallEnvironmentPanel({
  environment,
  isLoading,
  isInstalling,
  runtimeBlockMode,
  onRefresh,
  onInstall,
}: InstallEnvironmentPanelProps): JSX.Element {
  const { t } = useTranslation(["common", "install"]);
  const installBlockedByRuntime = runtimeBlockMode !== null;
  const installBlocked = installBlockedByRuntime;

  return (
    <section
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: 12,
        background: "#ffffff",
        padding: 16,
        display: "grid",
        gap: 14,
      }}
    >
      <div style={{ display: "grid", gap: 6 }}>
        <h3 style={{ margin: 0 }}>{t("install:environment.title")}</h3>
        <p style={{ margin: 0, color: "#64748b" }}>{t("install:environment.description")}</p>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <StatusPill
          label={environment?.nodeFound ? t("install:environment.pills.nodeReady") : t("install:environment.pills.nodeMissing")}
          ok={Boolean(environment?.nodeFound)}
        />
        <StatusPill label={environment?.npmFound ? t("install:environment.pills.npmReady") : t("install:environment.pills.npmMissing")} ok={Boolean(environment?.npmFound)} />
        <StatusPill
          label={environment?.openclawFound ? t("install:environment.pills.openclawInstalled") : t("install:environment.pills.openclawMissing")}
          ok={Boolean(environment?.openclawFound)}
        />
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        <EnvRow label={t("install:environment.labels.platform")} value={environment ? `${environment.platform} / ${environment.architecture}` : null} />
        <EnvRow label={t("install:environment.labels.homeDir")} value={environment?.homeDir} />
        <EnvRow label={t("install:environment.labels.configPath")} value={environment?.configPath} />
        <EnvRow label={t("install:environment.labels.nodeVersion")} value={environment?.nodeVersion} />
        <EnvRow label={t("install:environment.labels.nodePath")} value={environment?.nodePath} />
        <EnvRow label={t("install:environment.labels.npmVersion")} value={environment?.npmVersion} />
        <EnvRow label={t("install:environment.labels.openclawPath")} value={environment?.openclawPath} />
        <EnvRow label={t("install:environment.labels.openclawVersion")} value={environment?.openclawVersion} />
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={onRefresh}
          disabled={isLoading || isInstalling}
          style={{
            border: "1px solid #cbd5e1",
            background: "#ffffff",
            color: "#0f172a",
            borderRadius: 8,
            padding: "10px 14px",
            fontWeight: 600,
            cursor: isLoading || isInstalling ? "not-allowed" : "pointer",
            opacity: isLoading || isInstalling ? 0.6 : 1,
          }}
        >
          {isLoading ? t("install:actions.refreshing") : t("install:actions.refreshEnvironment")}
        </button>

        <button
          type="button"
          onClick={onInstall}
          disabled={isLoading || isInstalling || installBlocked}
          style={{
            border: "none",
            background: "#1d4ed8",
            color: "#ffffff",
            borderRadius: 8,
            padding: "10px 14px",
            fontWeight: 600,
            cursor: isLoading || isInstalling || installBlocked ? "not-allowed" : "pointer",
            opacity: isLoading || isInstalling || installBlocked ? 0.6 : 1,
          }}
        >
          {isInstalling
            ? t("install:actions.installing")
            : runtimeBlockMode === "preview"
              ? t("install:status.desktopRuntimeRequired")
              : installBlockedByRuntime
                ? t("install:status.desktopBridgeRequired")
                : t("install:actions.install")}
        </button>

        <Link
          to="/logs"
          style={{
            display: "inline-flex",
            alignItems: "center",
            border: "1px solid #cbd5e1",
            borderRadius: 8,
            padding: "10px 14px",
            fontWeight: 600,
            color: "#0f172a",
            textDecoration: "none",
            background: "#ffffff",
          }}
        >
          {t("install:actions.openLogs")}
        </Link>
      </div>

      {runtimeBlockMode === "preview" ? (
        <p style={{ margin: 0, fontSize: 13, color: "#92400e" }}>
          {t("install:status.previewMode")}
        </p>
      ) : installBlockedByRuntime ? (
        <p style={{ margin: 0, fontSize: 13, color: "#991b1b" }}>
          {t("install:status.runtimeUnavailable")}
        </p>
      ) : (
        <p style={{ margin: 0, fontSize: 13, color: "#475569" }}>
          {environment?.nodeFound && environment?.npmFound
            ? t("install:status.installHint")
            : t("install:status.bootstrapHint")}
        </p>
      )}
    </section>
  );
}
