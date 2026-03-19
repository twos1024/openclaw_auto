import { Outlet } from "react-router-dom";
import { Sidebar } from "@/components/navigation/Sidebar";

export function AppShell(): JSX.Element {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto bg-[hsl(var(--content))] p-6 transition-colors">
        <Outlet />
      </main>
    </div>
  );
}
