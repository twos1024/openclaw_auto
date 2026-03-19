import { useTranslation } from "react-i18next";
import type { InstallIssue } from "../../types/install";

export interface InstallIssueCardProps {
  issue: InstallIssue;
}

export function InstallIssueCard({ issue }: InstallIssueCardProps): JSX.Element {
  const { t } = useTranslation(["install"]);
  const title = t(`install:issue.kinds.${issue.failureKind}` as const, { defaultValue: t("install:issue.title") });
  const isGatewayWarning = issue.failureKind === "gateway-install-failed";

  return (
    <section
      style={{
        border: isGatewayWarning ? "1px solid #fcd34d" : "1px solid #fca5a5",
        borderRadius: 12,
        background: isGatewayWarning ? "#fffbeb" : "#fef2f2",
        padding: 16,
        display: "grid",
        gap: 8,
      }}
    >
      <strong>{title}</strong>
      <p style={{ margin: 0, color: "#334155" }}>{issue.message}</p>
      <p style={{ margin: 0, fontSize: 13, color: "#475569" }}>{t("install:issue.suggestionPrefix")}{issue.suggestion}</p>
    </section>
  );
}
