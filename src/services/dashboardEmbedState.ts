import type { DashboardEmbedPhase, DashboardEmbedPresentation } from "../types/dashboard";

export interface InferDashboardEmbedPhaseArgs {
  inspectedHref: string | null;
  inspectionFailed: boolean;
}

export function inferDashboardEmbedPhase({
  inspectedHref,
  inspectionFailed,
}: InferDashboardEmbedPhaseArgs): DashboardEmbedPhase {
  if (inspectionFailed) {
    return "loaded";
  }

  if (!inspectedHref || inspectedHref === "about:blank") {
    return "blocked";
  }

  return "loaded";
}

export function buildDashboardEmbedPresentation(phase: DashboardEmbedPhase): DashboardEmbedPresentation {
  switch (phase) {
    case "loading":
      return {
        title: "Connecting to embedded Dashboard",
        detail: "正在等待本地 OpenClaw Dashboard 响应并完成 iframe 加载。",
        suggestion: "如果长时间没有完成加载，可稍后重试或直接在外部窗口打开 Dashboard。",
      };
    case "timeout":
      return {
        title: "Dashboard connection timed out",
        detail: "在预定时间内没有等到内嵌 Dashboard 完成加载，可能是 Gateway 响应慢、端口不可达或本地页面没有返回内容。",
        suggestion: "建议先重载 iframe；如果仍失败，直接外部打开 Dashboard 或回到 Setup Assistant 检查服务状态。",
      };
    case "blocked":
      return {
        title: "Dashboard embedding is blocked",
        detail: "iframe 已触发加载，但页面仍停留在空白文档，通常意味着 X-Frame-Options、frame-ancestors 或其他嵌入策略阻止了内嵌展示。",
        suggestion: "可以直接外部打开 Dashboard；如果希望继续内嵌，需要检查本地 Dashboard 的 iframe 安全策略。",
      };
    case "loaded":
    default:
      return {
        title: "Dashboard loaded",
        detail: "内嵌 Dashboard 已可用。",
        suggestion: "如需刷新内容，可直接重载 iframe。",
      };
  }
}
