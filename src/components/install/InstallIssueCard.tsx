import type { InstallIssue } from "../../types/install";

const kindTitleMap: Record<string, string> = {
  "missing-npm": "缺少 Node.js / npm",
  "permission-denied": "权限不足",
  "network-failure": "网络连接失败",
  "command-timeout": "安装超时",
  "binary-not-found": "未找到 OpenClaw 程序",
  "gateway-install-failed": "Gateway 服务注册未完成",
  unknown: "安装遇到问题",
};

export interface InstallIssueCardProps {
  issue: InstallIssue;
}

export function InstallIssueCard({ issue }: InstallIssueCardProps): JSX.Element {
  const title = kindTitleMap[issue.failureKind] ?? "安装遇到问题";
  const isGatewayWarning = issue.failureKind === "gateway-install-failed";

  return (
    <section
      style={{
        border: isGatewayWarning ? "1px solid #fcd34d" : "1px solid #fca5a5",
        borderRadius: 12,
        background: isGatewayWarning ? "#fffbeb" : "#fef2f2",
        padding: 16,
        display: "grid",
        gap: 8,
      }}
    >
      <strong>{title}</strong>
      <p style={{ margin: 0, color: "#334155" }}>{issue.message}</p>
      <p style={{ margin: 0, fontSize: 13, color: "#475569" }}>建议：{issue.suggestion}</p>
    </section>
  );
}
