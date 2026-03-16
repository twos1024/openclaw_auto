import type { ReactNode } from "react";

export interface ModalDialogProps {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}

export function ModalDialog({
  title,
  open,
  onClose,
  children,
  footer,
  width = 720,
}: ModalDialogProps): JSX.Element | null {
  if (!open) return null;

  return (
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.55)",
        display: "grid",
        placeItems: "center",
        padding: 20,
        zIndex: 1000,
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: width,
          borderRadius: 16,
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          boxShadow: "0 32px 80px rgba(15, 23, 42, 0.24)",
          display: "grid",
          gap: 16,
          padding: 20,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center" }}>
          <h2 style={{ margin: 0 }}>{title}</h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: "1px solid #cbd5e1",
              borderRadius: 8,
              background: "#ffffff",
              color: "#0f172a",
              padding: "8px 10px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>

        <div style={{ display: "grid", gap: 16 }}>{children}</div>

        {footer ? <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>{footer}</div> : null}
      </section>
    </div>
  );
}
