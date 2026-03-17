import { describe, expect, it } from "vitest";
import { buildDashboardDiagnosticsModel } from "../../src/services/dashboardDiagnosticsService";
import type { DashboardProbeResult } from "../../src/types/dashboard";
import type { ServiceActionResult } from "../../src/services/serviceService";

const reachableProbe: DashboardProbeResult = {
  address: "http://127.0.0.1:18789",
  reachable: true,
  result: "reachable",
  httpStatus: 200,
  responseTimeMs: 148,
  detail: "Dashboard endpoint responded successfully.",
};

describe("dashboardDiagnosticsService", () => {
  it("highlights probe success and external open success", () => {
    const openResult: ServiceActionResult = {
      status: "success",
      detail: "Dashboard opened successfully.",
      suggestion: "Use the system browser if the embedded frame is blocked.",
    };

    const model = buildDashboardDiagnosticsModel({
      phase: "loaded",
      address: "http://127.0.0.1:18789",
      statusDetail: "Gateway is running.",
      platformNote: "Check iframe policy if the page stays blank.",
      probe: reachableProbe,
      externalOpenResult: openResult,
    });

    expect(model.items[2]).toMatchObject({
      id: "probe",
      tone: "healthy",
    });
    expect(model.items[2]?.meta).toContain("HTTP 200");
    expect(model.items[3]).toMatchObject({
      id: "external-open",
      tone: "healthy",
    });
  });

  it("surfaces blocked embeds and timed out endpoint probes", () => {
    const model = buildDashboardDiagnosticsModel({
      phase: "blocked",
      address: "http://127.0.0.1:18789",
      statusDetail: "Gateway is running.",
      platformNote: "macOS may block iframe embedding because of security headers.",
      probe: {
        address: "http://127.0.0.1:18789",
        reachable: false,
        result: "timeout",
        httpStatus: null,
        responseTimeMs: null,
        detail: "Dashboard endpoint timed out after 3000ms.",
      },
      externalOpenResult: null,
    });

    expect(model.items[0]).toMatchObject({
      id: "embed",
      tone: "warning",
    });
    expect(model.items[2]).toMatchObject({
      id: "probe",
      tone: "warning",
      detail: "Dashboard endpoint timed out after 3000ms.",
    });
    expect(model.items[3]).toMatchObject({
      id: "external-open",
      tone: "neutral",
    });
  });
});
