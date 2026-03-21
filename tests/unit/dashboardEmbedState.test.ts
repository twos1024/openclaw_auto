import { describe, expect, it } from "vitest";
import { inferDashboardEmbedPhase } from "../../src/renderer/services/dashboardEmbedState";

describe("dashboardEmbedState", () => {
  it("treats about:blank after load as an embed-blocked state", () => {
    const phase = inferDashboardEmbedPhase({
      inspectedHref: "about:blank",
      inspectionFailed: false,
    });

    expect(phase).toBe("blocked");
  });

  it("treats cross-origin inspection failure as a loaded dashboard", () => {
    const phase = inferDashboardEmbedPhase({
      inspectedHref: null,
      inspectionFailed: true,
    });

    expect(phase).toBe("loaded");
  });
});
