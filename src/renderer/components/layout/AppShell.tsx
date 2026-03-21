import { useCallback, useState } from "react";
import { Outlet } from "react-router-dom";
import { SetupAssistantDialog } from "@/components/dialogs/SetupAssistantDialog";
import { Sidebar } from "@/components/navigation/Sidebar";
import type { ShellOutletContext } from "@/hooks/useShellActions";

export function AppShell(): JSX.Element {
  const [isSetupAssistantOpen, setSetupAssistantOpen] = useState(false);

  const openSetupAssistant = useCallback(() => {
    setSetupAssistantOpen(true);
  }, []);

  const closeSetupAssistant = useCallback(() => {
    setSetupAssistantOpen(false);
  }, []);

  const shellContext: ShellOutletContext = {
    openSetupAssistant,
    closeSetupAssistant,
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto bg-[hsl(var(--content))] p-6 transition-colors">
        <Outlet context={shellContext} />
      </main>
      <SetupAssistantDialog open={isSetupAssistantOpen} onClose={closeSetupAssistant} />
    </div>
  );
}
