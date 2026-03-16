import { describe, expect, it } from "vitest";
import {
  buildDiagnosticSummaryText,
  buildDiagnosticsDownloadName,
  buildExportFeedback,
} from "../../src/services/diagnosticsService";
import type { DiagnosticSummary } from "../../src/types/logs";

const summaryFixture: DiagnosticSummary = {
  generatedAt: "2026-03-16T08:00:00.000Z",
  source: "gateway",
  keyword: "timeout",
  totalLines: 40,
  visibleLines: 2,
  summaries: [
    {
      id: "gateway_timeout",
      title: "请求超时",
      message: "Gateway 请求超时。",
      suggestion: "检查网络。",
      severity: "medium",
      code: "E_SHELL_TIMEOUT",
      count: 2,
      samples: ["timeout while connecting"],
    },
  ],
};

describe("diagnosticsService", () => {
  it("builds text diagnostics content with summary header and raw log tail", () => {
    const text = buildDiagnosticSummaryText(summaryFixture, [
      "[error] timeout while connecting",
      "[error] timeout while connecting",
    ]);

    expect(text).toContain("ClawDesk 诊断摘要");
    expect(text).toContain("日志类型: Gateway 日志");
    expect(text).toContain("timeout while connecting");
  });

  it("uses zip suffix for bundle export names", () => {
    const filename = buildDiagnosticsDownloadName("gateway", "bundle", 1710576000000);

    expect(filename).toBe("clawdesk-diagnostics-gateway-1710576000000.zip");
  });

  it("renders bundle export feedback with actual output path", () => {
    const message = buildExportFeedback("bundle", {
      filePath: "C:\\Temp\\clawdesk-diagnostics-gateway.zip",
      format: "bundle",
      includedFiles: ["summary.txt", "logs/install.log"],
    });

    expect(message).toBe("诊断包已导出到 C:\\Temp\\clawdesk-diagnostics-gateway.zip（共 2 个文件）");
  });
});
