import { Outlet } from "react-router-dom";
import { Sidebar } from "@/components/navigation/Sidebar";

export function AppShell(): JSX.Element {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto p-6 bg-[hsl(210_20%_97%)] dark:bg-background">
        <Outlet />
      </main>
    </div>
  );
}
