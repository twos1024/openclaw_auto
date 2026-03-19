import { Navigate, useLocation } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { useSettingsStore } from "@/store/useSettingsStore";

const setupSupportRoutes = new Set([
  "/",
  "/setup",
  "/install",
  "/config",
  "/service",
  "/runbook",
  "/logs",
  "/settings",
  "/dashboard",
  "/overview",
]);

export function SetupAwareIndexRedirect(): JSX.Element {
  const setupComplete = useSettingsStore((state) => state.setupComplete);
  return <Navigate to={setupComplete ? "/chat" : "/overview"} replace />;
}

export function RequireSetupShell(): JSX.Element {
  const setupComplete = useSettingsStore((state) => state.setupComplete);
  const location = useLocation();
  if (!setupComplete && !setupSupportRoutes.has(location.pathname)) {
    return <Navigate to="/setup" replace />;
  }
  return <AppShell />;
}
