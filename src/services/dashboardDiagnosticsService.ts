import type {
  DashboardDiagnosticsItem,
  DashboardDiagnosticsModel,
  DashboardEmbedPhase,
  DashboardProbeResult,
} from "../types/dashboard";
import type { ServiceActionResult } from "./serviceService";

interface BuildDashboardDiagnosticsArgs {
  phase: DashboardEmbedPhase;
  address: string | null;
  statusDetail: string;
  platformNote: string;
  probe: DashboardProbeResult | null;
  externalOpenResult: ServiceActionResult | null;
}

function buildEmbedItem(phase: DashboardEmbedPhase): DashboardDiagnosticsItem {
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
  address,
  statusDetail,
  platformNote,
  probe,
  externalOpenResult,
}: BuildDashboardDiagnosticsArgs): DashboardDiagnosticsModel {
  return {
    items: [
      buildEmbedItem(phase),
      {
        id: "gateway",
        title: "Gateway Status",
        tone: address ? "healthy" : "warning",
        detail: statusDetail,
        meta: address ?? undefined,
      },
      buildProbeItem(probe, address),
      buildExternalOpenItem(externalOpenResult),
    ],
    platformNote,
  };
}
