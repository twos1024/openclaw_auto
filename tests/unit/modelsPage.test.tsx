/** @vitest-environment jsdom */
import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { ModelsPage } from "../../src/pages/ModelsPage";

const mockGetGatewayStatus = vi.hoisted(() => vi.fn());
const mockGatewayFetch = vi.hoisted(() => vi.fn());

const translationMap = vi.hoisted(
  (): Record<string, string> => ({
    "banner.offline.title": "Gateway 未运行",
    "banner.offline.description": "启动 Gateway 后即可读取最近模型用量。",
    "banner.error.title": "无法加载模型用量",
    "banner.error.description": "请在确认网关连接后重试。",
    "page.descriptionRunning": "Gateway 运行中 · 正在读取最近模型用量",
    "page.descriptionIdle": "Gateway 未运行 · 启动后可查看模型用量",
    "toolbar.timeRange.7d": "最近 7 天",
    "toolbar.timeRange.30d": "最近 30 天",
    "toolbar.timeRange.all": "全部",
    "status.loading": "加载中...",
    "status.empty": "暂无模型用量数据。",
    "stats.totalTokens": "总 Token 消耗",
    "stats.estimatedCost": "预估费用",
    "stats.modelCount": "使用模型数",
    "stats.averageCost": "平均每次费用",
    "stats.records": "{{count}} 条记录",
    "stats.range.7d": "近 7 天",
    "stats.range.30d": "近 30 天",
    "stats.range.all": "全部时间",
    "stats.perRecord": "按记录平均",
    "table.title": "模型用量明细",
    "table.description": "按请求记录展示 token 消耗和费用趋势。",
    "table.headers.date": "日期",
    "table.headers.model": "模型",
    "table.headers.input": "输入",
    "table.headers.output": "输出",
    "table.headers.total": "总计",
    "table.headers.cost": "费用",
  }),
);

vi.mock("../../src/services/serviceService", () => ({
  serviceService: {
    getGatewayStatus: mockGetGatewayStatus,
  },
}));

vi.mock("../../src/lib/gateway-client", () => ({
  gatewayFetch: mockGatewayFetch,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => translationMap[key] ?? key,
  }),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

afterEach(() => {
  mockGetGatewayStatus.mockReset();
  mockGatewayFetch.mockReset();
  document.body.innerHTML = "";
});

afterAll(() => {
  delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
});

describe("ModelsPage", () => {
  it("shows the offline notice when the gateway is not running", async () => {
    mockGetGatewayStatus.mockResolvedValue({
      running: false,
    });

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(React.createElement(ModelsPage));
      await flush();
    });

    expect(container.textContent).toContain("Gateway 未运行");
    expect(container.textContent).toContain("启动 Gateway 后即可读取最近模型用量。");
    expect(mockGatewayFetch).not.toHaveBeenCalled();

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("shows an error notice when usage history cannot be loaded", async () => {
    mockGetGatewayStatus.mockResolvedValue({
      running: true,
    });
    mockGatewayFetch.mockRejectedValue(new Error("network down"));

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(React.createElement(ModelsPage));
      await flush();
    });

    expect(container.textContent).toContain("无法加载模型用量");
    expect(container.textContent).toContain("network down");

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
