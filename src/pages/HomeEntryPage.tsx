import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { NoticeBanner } from "../components/common/NoticeBanner";
import { PageHero } from "../components/common/PageHero";
import { Button } from "../components/ui/button";
import { useRunbook } from "../hooks/useRunbook";
import { useShellActions } from "../hooks/useShellActions";
import { OverviewPage } from "./OverviewPage";

const linkPrimary =
  "inline-block rounded-lg bg-primary px-3 py-2 text-sm font-bold text-primary-foreground no-underline hover:bg-primary/90 transition-colors";
const linkOutline =
  "inline-block rounded-lg border border-input bg-transparent px-3 py-2 text-sm font-bold text-foreground no-underline hover:bg-accent transition-colors";

function blockerToneForLevel(level: string | undefined): "info" | "warning" | "error" | "success" {
  if (level === "offline") return "error";
  if (level === "degraded") return "warning";
  if (level === "healthy") return "success";
  return "info";
}

export function HomeEntryPage(): JSX.Element {
  const { t } = useTranslation("overview");
  const { model, isLoading, errorText } = useRunbook(true);
  const { openSetupAssistant } = useShellActions();
  const [hasAutoOpened, setHasAutoOpened] = useState<boolean>(false);

  const currentStepLabel = useMemo(() => {
    const route = model?.primaryRoute ?? "";
    if (route.startsWith("/install")) return t("home.entry.steps.install");
    if (route.startsWith("/config")) return t("home.entry.steps.config");
    if (route.startsWith("/service")) return t("home.entry.steps.service");
    if (route.startsWith("/dashboard")) return t("home.entry.steps.dashboard");
    return t("home.entry.steps.runbook");
  }, [model?.primaryRoute, t]);

  const blockerTone = blockerToneForLevel(model?.currentBlocker?.level);

  useEffect(() => {
    if (!hasAutoOpened && model?.currentBlocker) {
      openSetupAssistant();
      setHasAutoOpened(true);
    }
  }, [hasAutoOpened, model?.currentBlocker, openSetupAssistant]);

  if (model && !model.currentBlocker) {
    return <Navigate to={model.primaryRoute} replace />;
  }

  if (isLoading) {
    return (
      <section className="grid gap-2 rounded-xl border border-border bg-card p-5">
        <strong className="text-foreground">{t("home.loading.title")}</strong>
        <p className="m-0 text-muted-foreground">{t("home.loading.description")}</p>
      </section>
    );
  }

  if (model?.currentBlocker) {
    return (
      <div className="grid gap-4">
        <PageHero
          title={t("home.entry.title")}
          description={t("home.entry.description")}
          meta={t("home.entry.meta", {
            checkedAt: new Date(model.lastCheckedAt).toLocaleString(),
          })}
          action={
            <Button onClick={openSetupAssistant}>
              {t("home.entry.openAssistant")}
            </Button>
          }
        />

        <NoticeBanner title={t("home.entry.noticeTitle", { step: currentStepLabel })} tone={blockerTone}>
          <p className="m-0">{t("home.entry.noticeDescription")}</p>
          <p className="mt-2">{t("home.entry.noticePrimaryHint", { step: currentStepLabel })}</p>
          <div className="mt-3 flex flex-wrap gap-2.5">
            <Link to={model.primaryRoute} className={linkPrimary}>
              {t("home.entry.continue")}
            </Link>
            <Link to="/runbook" className={linkOutline}>
              {t("home.entry.openRunbook")}
            </Link>
          </div>
        </NoticeBanner>

        <OverviewPage autoRefreshMs={15000} />
      </div>
    );
  }

  return (
    <section className="grid gap-2 rounded-xl border border-red-300 bg-red-50 p-5 dark:border-red-700 dark:bg-red-950/40">
      <strong className="text-red-800 dark:text-red-300">{t("home.error.title")}</strong>
      <p className="m-0 text-red-900 dark:text-red-200">
        {errorText ?? t("home.error.description")}
      </p>
      <div className="flex flex-wrap gap-2.5">
        <Link to="/overview" className={linkPrimary}>
          {t("home.actions.overview")}
        </Link>
        <Link to="/install?wizard=1" className={linkOutline}>
          {t("home.actions.installWizard")}
        </Link>
      </div>
    </section>
  );
}
