import type { GatewayStatus } from "../../services/serviceService";

export interface EndpointCardProps {
  status: GatewayStatus | null;
}

function valueOrDash(value: string | number | null): string {
  if (value === null || value === "") return "-";
  return String(value);
}

export function EndpointCard({ status }: EndpointCardProps): JSX.Element {
  const port = status?.port ?? null;
  const address = status?.address ?? (port ? `http://127.0.0.1:${port}` : null);
  const lastStartedAt = status?.lastStartedAt
    ? new Date(status.lastStartedAt).toLocaleString()
    : null;

  return (
    <section
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: 12,
        background: "#ffffff",
        padding: 16,
      }}
    >
      <h3 style={{ marginTop: 0, marginBottom: 12 }}>Gateway Endpoint</h3>
      <div style={{ display: "grid", gap: 8 }}>
        <p style={{ margin: 0 }}>
          <strong>Port:</strong> {valueOrDash(port)}
        </p>
        <p style={{ margin: 0 }}>
          <strong>Address:</strong> {valueOrDash(address)}
        </p>
        <p style={{ margin: 0 }}>
          <strong>Last Started:</strong> {valueOrDash(lastStartedAt)}
        </p>
      </div>
    </section>
  );
}

