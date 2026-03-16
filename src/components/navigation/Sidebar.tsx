import { NavLink } from "react-router-dom";

type NavItem = {
  to: string;
  label: string;
};

const navItems: NavItem[] = [
  { to: "/", label: "Overview" },
  { to: "/install", label: "Install" },
  { to: "/config", label: "Config" },
  { to: "/service", label: "Service" },
  { to: "/logs", label: "Logs" },
  { to: "/settings", label: "Settings" },
];

export function Sidebar(): JSX.Element {
  return (
    <aside
      style={{
        borderRight: "1px solid #e2e8f0",
        background: "#f1f5f9",
        padding: 16,
      }}
    >
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 20, margin: 0, color: "#0f172a" }}>ClawDesk</h1>
        <p style={{ marginTop: 6, marginBottom: 0, fontSize: 12, color: "#64748b" }}>
          OpenClaw Desktop Console
        </p>
      </div>

      <nav style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            style={({ isActive }) => ({
              display: "block",
              padding: "10px 12px",
              borderRadius: 8,
              textDecoration: "none",
              fontSize: 14,
              fontWeight: 600,
              color: isActive ? "#ffffff" : "#334155",
              background: isActive ? "#0f172a" : "transparent",
            })}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
