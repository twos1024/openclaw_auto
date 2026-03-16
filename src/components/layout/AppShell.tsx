import { Outlet } from "react-router-dom";
import { useState } from "react";
import { Sidebar } from "../navigation/Sidebar";
import { SetupAssistantDialog } from "../dialogs/SetupAssistantDialog";
import type { ShellOutletContext } from "../../hooks/useShellActions";

export function AppShell(): JSX.Element {
  const [isSetupAssistantOpen, setIsSetupAssistantOpen] = useState<boolean>(false);
  const outletContext: ShellOutletContext = {
    openSetupAssistant: () => setIsSetupAssistantOpen(true),
    closeSetupAssistant: () => setIsSetupAssistantOpen(false),
  };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "240px 1fr",
        minHeight: "100vh",
        background: "#f8fafc",
      }}
    >
      <Sidebar />

      <main
        style={{
          padding: 20,
          overflow: "auto",
          display: "grid",
          gap: 16,
        }}
      >
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
            alignItems: "center",
            border: "1px solid #e2e8f0",
            borderRadius: 14,
            background: "#ffffff",
            padding: "14px 16px",
          }}
        >
          <div>
            <strong style={{ display: "block", color: "#0f172a" }}>ClawDesk Workspace</strong>
            <span style={{ display: "block", marginTop: 4, fontSize: 13, color: "#64748b" }}>
              Install, configure, operate, diagnose, and open the embedded OpenClaw dashboard.
            </span>
          </div>
          <button
            type="button"
            onClick={outletContext.openSetupAssistant}
            style={{
              border: "none",
              borderRadius: 8,
              background: "#0f172a",
              color: "#ffffff",
              padding: "10px 14px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Setup Assistant
          </button>
        </header>

        <Outlet context={outletContext} />
        <SetupAssistantDialog
          open={isSetupAssistantOpen}
          onClose={outletContext.closeSetupAssistant}
        />
      </main>
    </div>
  );
}
