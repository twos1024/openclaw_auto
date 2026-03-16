import { Outlet } from "react-router-dom";
import { Sidebar } from "../navigation/Sidebar";

export function AppShell(): JSX.Element {
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
        }}
      >
        <Outlet />
      </main>
    </div>
  );
}
