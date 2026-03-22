import { describe, expect, it } from "vitest";
import { normalizeDashboardSrc } from "../../src/lib/dashboardUrl";

describe("DashboardFrame URL normalization", () => {
  it("adds a trailing slash to origin URLs", () => {
    expect(normalizeDashboardSrc("http://127.0.0.1:18789")).toBe("http://127.0.0.1:18789/");
  });

  it("preserves explicit dashboard paths", () => {
    expect(normalizeDashboardSrc("http://127.0.0.1:18789/dashboard")).toBe("http://127.0.0.1:18789/dashboard");
  });

  it("returns malformed URLs unchanged", () => {
    expect(normalizeDashboardSrc("not-a-valid-url")).toBe("not-a-valid-url");
  });
});
