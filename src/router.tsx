import { createHashRouter, Navigate } from "react-router-dom";
import { RequireSetupShell, SetupAwareIndexRedirect } from "@/components/layout/SetupRouteGuards";
import { ChatPage } from "@/pages/ChatPage";
import { AgentsPage } from "@/pages/AgentsPage";
import { ModelsPage } from "@/pages/ModelsPage";
import { ChannelsPage } from "@/pages/ChannelsPage";
import { ProvidersPage } from "@/pages/ProvidersPage";
import { CronPage } from "@/pages/CronPage";
import { SetupPage } from "@/pages/SetupPage";
import { PluginsPage } from "@/pages/PluginsPage";
import { SkillsPage } from "@/pages/SkillsPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { FeedbackPage } from "@/pages/FeedbackPage";

export const router = createHashRouter([
  {
    path: "/setup",
    element: <SetupPage />,
  },
  {
    path: "/",
    element: <RequireSetupShell />,
    children: [
      {
        index: true,
        element: <SetupAwareIndexRedirect />,
      },
      { path: "chat", element: <ChatPage /> },
      { path: "agents", element: <AgentsPage /> },
      { path: "instances", element: <Navigate to="/agents" replace /> },
      { path: "models", element: <ModelsPage /> },
      { path: "token", element: <Navigate to="/models" replace /> },
      { path: "channels", element: <ChannelsPage /> },
      { path: "providers", element: <ProvidersPage /> },
      { path: "cron", element: <CronPage /> },
      { path: "setup", element: <Navigate to="/setup" replace /> },
      { path: "plugins", element: <PluginsPage /> },
      { path: "skills", element: <SkillsPage /> },
      { path: "settings", element: <SettingsPage /> },
      { path: "feedback", element: <FeedbackPage /> },
    ],
  },
]);
