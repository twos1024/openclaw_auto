import { createHashRouter } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { HomeEntryPage } from "./pages/HomeEntryPage";
import { OverviewPage } from "./pages/OverviewPage";
import { RunbookPage } from "./pages/RunbookPage";
import { DashboardPage } from "./pages/DashboardPage";
import { InstallPage } from "./pages/InstallPage";
import { ConfigPage } from "./pages/ConfigPage";
import { ServicePage } from "./pages/ServicePage";
import { LogsPage } from "./pages/LogsPage";
import { SettingsPage } from "./pages/SettingsPage";

export const router = createHashRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      {
        index: true,
        element: <HomeEntryPage />,
      },
      {
        path: "overview",
        element: <OverviewPage autoRefreshMs={15000} />,
      },
      {
        path: "runbook",
        element: <RunbookPage />,
      },
      {
        path: "dashboard",
        element: <DashboardPage />,
      },
      {
        path: "install",
        element: <InstallPage />,
      },
      {
        path: "config",
        element: <ConfigPage />,
      },
      {
        path: "service",
        element: <ServicePage />,
      },
      {
        path: "logs",
        element: <LogsPage />,
      },
      {
        path: "settings",
        element: <SettingsPage />,
      },
    ],
  },
]);
