import type {
  DashboardDiagnosticsItem,
  DashboardDiagnosticsModel,
  DashboardEmbedPhase,
  DashboardProbeResult,
  DashboardRecommendedAction,
} from "../types/dashboard";
import type { GatewayRuntimeState, ServiceActionResult } from "./serviceService";

interface BuildDashboardDiagnosticsArgs {
  phase: DashboardEmbedPhase | "unavailable";
  gatewayState: GatewayRuntimeState | null;
  gatewayRunning: boolean;
  address: string | null;
  statusDetail: string;
  platformNote: string;
  probe: DashboardProbeResult | null;
  externalOpenResult: ServiceActionResult | null;
}

function buildEmbedItem(phase: DashboardEmbedPhase | "unavailable"): DashboardDiagnosticsItem {
  switch (phase) {
    case "loaded":
      return {
        id: "embed",
        title: "Embed Frame",
        tone: "healthy",
        detail: "Embedded dashboard loaded successfully.",
      };
    case "loading":
      return {
        id: "embed",
        title: "Embed Frame",
        tone: "neutral",
        detail: "Embedded dashboard is still loading.",
      };
    case "timeout":
      return {
        id: "embed",
        title: "Embed Frame",
        tone: "warning",
        detail: "Embedded dashboard timed out before the frame became ready.",
      };
    case "blocked":
      return {
        id: "embed",
        title: "Embed Frame",
        tone: "warning",
        detail: "Embedded dashboard appears blocked. Check iframe policy or security headers.",
      };
    case "unavailable":
      return {
        id: "embed",
        title: "Embed Frame",
        tone: "neutral",
        detail: "Gateway is not running yet, so the embedded dashboard has not been loaded.",
      };
  }
}

function buildProbeItem(probe: DashboardProbeResult | null, address: string | null): DashboardDiagnosticsItem {
  if (!address) {
    return {
      id: "probe",
      title: "Local Endpoint Probe",
      tone: "neutral",
      detail: "Gateway is not running, so the dashboard endpoint has not been probed yet.",
    };
  }

  if (!probe) {
    return {
      id: "probe",
      title: "Local Endpoint Probe",
      tone: "neutral",
      detail: "Probe has not run yet.",
    };
  }

  if (probe.result === "probing") {
    return {
      id: "probe",
      title: "Local Endpoint Probe",
      tone: "neutral",
      detail: "Probing dashboard endpoint...",
    };
  }

  if (probe.result === "idle") {
    return {
      id: "probe",
      title: "Local Endpoint Probe",
      tone: "neutral",
      detail: probe.detail,
    };
  }

  if (probe.result === "reachable") {
    return {
      id: "probe",
      title: "Local Endpoint Probe",
      tone: "healthy",
      detail: probe.detail,
      meta: [
        probe.httpStatus ? `HTTP ${probe.httpStatus}` : null,
        probe.responseTimeMs !== null ? `${probe.responseTimeMs} ms` : null,
      ]
        .filter(Boolean)
        .join(" | "),
    };
  }

  if (probe.result === "timeout") {
    return {
      id: "probe",
      title: "Local Endpoint Probe",
      tone: "warning",
      detail: probe.detail,
    };
  }

  return {
    id: "probe",
    title: "Local Endpoint Probe",
    tone: "error",
    detail: probe.detail,
  };
}

function buildRecommendedAction({
  phase,
  gatewayRunning,
  address,
  probe,
}: Pick<BuildDashboardDiagnosticsArgs, "phase" | "gatewayRunning" | "address" | "probe">): DashboardRecommendedAction {
  if (phase === "blocked") {
    return {
      label: "Open Runbook",
      route: "/runbook",
      detail: "The embedded dashboard looks blocked. Review the Runbook for recovery steps and fallback actions.",
    };
  }

  if (!gatewayRunning || !address) {
    return {
      label: "Open Service",
      route: "/service",
      detail: "Gateway is not running yet. Start it from Service before loading the embedded dashboard.",
    };
  }

  if (probe?.result === "timeout") {
    return {
      label: "Open Service",
      route: "/service",
      detail: "The local endpoint timed out. Restart Gateway or inspect service logs for the failure.",
    };
  }

  if (probe?.result === "unreachable" || probe?.result === "invalid-address") {
    return {
      label: "Open Service",
      route: "/service",
      detail: "The dashboard endpoint is unreachable. Check the address and Gateway state in Service.",
    };
  }

  if (probe?.result === "reachable") {
    return {
      label: "Stay in Dashboard",
      route: "/dashboard",
      detail: "The local endpoint is healthy. Continue working in the embedded dashboard.",
    };
  }

  return {
    label: "Open Service",
    route: "/service",
    detail: "The dashboard endpoint is not ready yet. Open Service, then refresh status once Gateway is running.",
  };
}

function buildExternalOpenItem(result: ServiceActionResult | null): DashboardDiagnosticsItem {
  if (!result) {
    return {
      id: "external-open",
      title: "Open External",
      tone: "neutral",
      detail: "No external open attempt has been recorded in this session.",
    };
  }

  return {
    id: "external-open",
    title: "Open External",
    tone: result.status === "success" ? "healthy" : result.status === "failure" ? "warning" : "error",
    detail: result.detail,
    meta: result.code ?? undefined,
  };
}

export function buildDashboardDiagnosticsModel({
  phase,
  gatewayState,
  gatewayRunning,
  address,
  statusDetail,
  platformNote,
  probe,
  externalOpenResult,
}: BuildDashboardDiagnosticsArgs): DashboardDiagnosticsModel {
  const gatewayTone =
    gatewayRunning ? "healthy" : gatewayState === "starting" || gatewayState === "stopping" ? "warning" : "error";

  return {
    items: [
      buildEmbedItem(phase),
      {
        id: "gateway",
        title: "Gateway Status",
        tone: gatewayTone,
        detail: statusDetail,
        meta: address ?? undefined,
      },
      buildProbeItem(probe, address),
      buildExternalOpenItem(externalOpenResult),
    ],
    recommendedAction: buildRecommendedAction({ phase, gatewayRunning, address, probe }),
    platformNote,
  };
}
