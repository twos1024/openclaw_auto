import { useEffect, useState } from "react";
import { invokeCommand } from "../../services/tauriClient";
import { useAppStore } from "../../store/useAppStore";
import type { AdminStatus } from "../../store/useAppStore";

export function AdminBanner(): JSX.Element | null {
  const { adminStatus, adminChecked, setAdminStatus } = useAppStore();
  const [isRelaunching, setIsRelaunching] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (adminChecked) return;
    const check = async () => {
      const result = await invokeCommand<AdminStatus>("check_admin_status");
      if (result.success && result.data) {
        setAdminStatus(result.data);
      }
    };
    void check();
  }, [adminChecked, setAdminStatus]);

  if (!adminChecked || !adminStatus) return null;
  if (adminStatus.isElevated) return null;
  if (!adminStatus.elevationRequired) return null;
  if (dismissed) return null;

  const handleElevate = async () => {
    setIsRelaunching(true);
    await invokeCommand("relaunch_as_admin");
    // If relaunch failed (launched=false), revert button state
    setIsRelaunching(false);
  };

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 12,
      padding: "10px 16px",
      background: "var(--color-amber-50)",
      borderBottom: "1px solid var(--color-amber-200)",
      fontSize: "var(--text-base)",
    }}>
      <span style={{ fontSize: 16 }}>⚠️</span>
      <div style={{ flex: 1, color: "var(--color-amber-700)" }}>
        <strong>未以管理员权限运行</strong>
        <span style={{ marginLeft: 8, fontWeight: 400 }}>
          {adminStatus.suggestion}
        </span>
      </div>
      <button
        type="button"
        disabled={isRelaunching}
        onClick={() => void handleElevate()}
        style={{
          padding: "5px 14px",
          borderRadius: "var(--radius-md)",
          border: "none",
          background: "var(--color-amber-500)",
          color: "#fff",
          fontWeight: 600,
          fontSize: "var(--text-sm)",
          cursor: isRelaunching ? "not-allowed" : "pointer",
          opacity: isRelaunching ? 0.7 : 1,
          whiteSpace: "nowrap",
        }}
      >
        {isRelaunching ? "正在提权..." : "以管理员身份重启"}
      </button>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        style={{
          background: "none",
          border: "none",
          color: "var(--color-amber-700)",
          cursor: "pointer",
          fontSize: 18,
          lineHeight: 1,
          padding: "2px 4px",
        }}
        aria-label="关闭提示"
      >
        ×
      </button>
    </div>
  );
}
