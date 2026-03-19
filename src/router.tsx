import { createHashRouter, Navigate } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { ChatPage } from "@/pages/ChatPage";
import { InstancesPage } from "@/pages/InstancesPage";
import { TokenPage } from "@/pages/TokenPage";
import { PluginsPage } from "@/pages/PluginsPage";
import { SkillsPage } from "@/pages/SkillsPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { FeedbackPage } from "@/pages/FeedbackPage";

export const router = createHashRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      {
        index: true,
        element: <Navigate to="/chat" replace />,
      },
      { path: "chat",      element: <ChatPage /> },
      { path: "instances", element: <InstancesPage /> },
      { path: "token",     element: <TokenPage /> },
      { path: "plugins",   element: <PluginsPage /> },
      { path: "skills",    element: <SkillsPage /> },
      { path: "settings",  element: <SettingsPage /> },
      { path: "feedback",  element: <FeedbackPage /> },
    ],
  },
]);
