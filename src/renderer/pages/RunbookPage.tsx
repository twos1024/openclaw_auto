import { useTranslation } from "react-i18next";
import { PageHero } from "../components/common/PageHero";
import { NoticeBanner } from "../components/common/NoticeBanner";
import { RunbookContextPanel } from "../components/runbook/RunbookContextPanel";
import { RunbookLaunchChecks } from "../components/runbook/RunbookLaunchChecks";
import { RunbookStepList } from "../components/runbook/RunbookStepList";
import { useRunbook } from "../hooks/useRunbook";

export function RunbookPage(): JSX.Element {
  const { t } = useTranslation("runbook");
  const { model, isLoading, errorText, refresh } = useRunbook(true, 15000);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <PageHero
        title={t("page.title")}
        description={t("page.description")}
        meta={model ? t("page.lastCheckedAt", { value: new Date(model.lastCheckedAt).toLocaleString() }) : undefined}
        action={
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={isLoading}
            style={{
              border: "none",
              borderRadius: 8,
              background: "#0f172a",
              color: "#ffffff",
              padding: "10px 14px",
              fontWeight: 700,
              cursor: isLoading ? "not-allowed" : "pointer",
              opacity: isLoading ? 0.6 : 1,
            }}
          >
            {isLoading ? t("page.refreshing") : t("page.refresh")}
          </button>
        }
      />

      {errorText ? (
        <NoticeBanner title={t("page.unavailable")} tone="error">
          <p style={{ margin: 0 }}>{errorText}</p>
        </NoticeBanner>
      ) : null}

      {model ? (
        <>
          <RunbookContextPanel
            title={model.headline}
            description={model.summary}
            model={model}
          />
          <RunbookLaunchChecks model={model} />
          <RunbookStepList model={model} />
        </>
      ) : null}
    </div>
  );
}
