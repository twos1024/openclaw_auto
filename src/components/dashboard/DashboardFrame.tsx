export interface DashboardFrameProps {
  src: string;
  frameKey: number;
}

export function DashboardFrame({ src, frameKey }: DashboardFrameProps): JSX.Element {
  return (
    <section
      style={{
        border: "1px solid #cbd5e1",
        borderRadius: 16,
        overflow: "hidden",
        background: "#0f172a",
        minHeight: "72vh",
      }}
    >
      <iframe
        key={frameKey}
        title="OpenClaw Dashboard"
        src={src}
        style={{
          width: "100%",
          minHeight: "72vh",
          border: "none",
          background: "#ffffff",
        }}
      />
    </section>
  );
}
