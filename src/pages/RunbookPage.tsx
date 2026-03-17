import { PageHero } from "../components/common/PageHero";
import { NoticeBanner } from "../components/common/NoticeBanner";
import { RunbookContextPanel } from "../components/runbook/RunbookContextPanel";
import { RunbookLaunchChecks } from "../components/runbook/RunbookLaunchChecks";
import { RunbookStepList } from "../components/runbook/RunbookStepList";
import { useRunbook } from "../hooks/useRunbook";

export function RunbookPage(): JSX.Element {
  const { model, isLoading, errorText, refresh } = useRunbook(true, 15000);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <PageHero
        title="Runbook"
        description="Runbook is the full-screen guided workflow for setup and recovery. Use it to see the current blocker, ordered next steps, and fast links to supporting pages."
        meta={model ? `Last checked: ${new Date(model.lastCheckedAt).toLocaleString()}` : undefined}
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
            {isLoading ? "Refreshing..." : "Refresh Runbook"}
          </button>
        }
      />

      {errorText ? (
        <NoticeBanner title="Runbook Unavailable" tone="error">
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
