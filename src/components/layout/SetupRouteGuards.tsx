import { Navigate, useLocation } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { useSettingsStore } from "@/store/useSettingsStore";

export function SetupAwareIndexRedirect(): JSX.Element {
  const setupComplete = useSettingsStore((state) => state.setupComplete);
  return <Navigate to={setupComplete ? "/chat" : "/setup"} replace />;
}

export function RequireSetupShell(): JSX.Element {
  const setupComplete = useSettingsStore((state) => state.setupComplete);
  const location = useLocation();
  if (!setupComplete && location.pathname !== "/setup") {
    return <Navigate to="/setup" replace />;
  }
  return <AppShell />;
}
