import { describe, expect, it } from "vitest";
import { extractErrorSummaries, mapErrorCode, mapStderr } from "../../src/utils/errorMap";

describe("errorMap", () => {
  it("maps config corruption error code to readable Chinese hint", () => {
    const hint = mapErrorCode("E_CONFIG_CORRUPTED");

    expect(hint?.title).toBe("配置文件损坏");
  });

  it("maps port conflict stderr to high severity conflict hint", () => {
    const hint = mapStderr("listen EADDRINUSE: address already in use 0.0.0.0:8080");

    expect(hint?.code).toBe("EADDRINUSE");
  });

  it("extracts summary with aggregated count for repeated log errors", () => {
    const summaries = extractErrorSummaries([
      "[error] EADDRINUSE: address already in use 0.0.0.0:8080",
      "[error] EADDRINUSE: address already in use 0.0.0.0:8080",
    ]);

    expect(summaries[0]?.count).toBe(2);
  });

  it("falls back to generic summary for unmapped fatal errors", () => {
    const summaries = extractErrorSummaries([
      "[fatal] unknown crash happened in gateway runtime",
    ]);

    expect(summaries[0]?.title).toBe("通用运行错误");
  });
});

