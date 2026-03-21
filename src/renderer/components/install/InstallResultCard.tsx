import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { InstallActionResult } from "../../types/install";

export interface InstallResultCardProps {
  result: InstallActionResult | null;
}

export function InstallResultCard({ result }: InstallResultCardProps): JSX.Element | null {
  const { t } = useTranslation(["install"]);
  if (!result) {
    return null;
  }

  const isSuccess = result.status === "success";
  const isWarning = result.status === "warning";
  const isOk = isSuccess || isWarning;

  const border = isSuccess ? "#86efac" : isWarning ? "#fcd34d" : "#fca5a5";
  const background = isSuccess ? "#f0fdf4" : isWarning ? "#fffbeb" : "#fef2f2";
  const nextRoute = isOk ? "/config" : "/logs";
  const nextLabel = isOk ? t("install:result.nextConfig") : t("install:result.viewLogs");

  const title = isSuccess ? t("install:result.titleSuccess") : isWarning ? t("install:result.titleWarning") : t("install:result.titleFailure");
  const hint = isSuccess
    ? t("install:result.hintSuccess")
    : isWarning
      ? t("install:result.hintWarning")
      : t("install:result.hintFailure");

  return (
    <section
      style={{
        border: `1px solid ${border}`,
        borderRadius: 12,
        background,
        padding: 16,
        display: "grid",
        gap: 10,
      }}
    >
      <strong style={{ fontSize: 15 }}>{title}</strong>
      <p style={{ margin: 0, color: "#334155" }}>{result.detail}</p>
      <p style={{ margin: 0, fontSize: 13, color: "#475569" }}>{hint}</p>
      <div>
        <Link
          to={nextRoute}
          style={{
            display: "inline-block",
            borderRadius: 8,
            padding: "9px 14px",
            background: "#0f172a",
            color: "#ffffff",
            textDecoration: "none",
            fontWeight: 700,
          }}
        >
          {nextLabel}
        </Link>
      </div>
    </section>
  );
}
