import type { InstallIssue } from "../../types/install";

const kindLabelMap: Record<string, string> = {
  "missing-npm": "缺少 npm",
  "permission-denied": "权限不足",
  "network-failure": "网络或镜像异常",
  "command-timeout": "命令执行超时",
  "binary-not-found": "无法定位 OpenClaw 可执行文件",
  "gateway-install-failed": "Gateway 托管安装失败",
  unknown: "未知安装问题",
};

export interface InstallIssueCardProps {
  issue: InstallIssue;
}

export function InstallIssueCard({ issue }: InstallIssueCardProps): JSX.Element {
  return (
    <section
      style={{
        border: "1px solid #fcd34d",
        borderRadius: 12,
        background: "#fffbeb",
        padding: 16,
        display: "grid",
        gap: 8,
      }}
    >
      <strong>安装问题摘要</strong>
      <p style={{ margin: 0, color: "#475569" }}>问题类型：{kindLabelMap[issue.failureKind] ?? issue.failureKind}</p>
      <p style={{ margin: 0, color: "#475569" }}>执行步骤：{issue.step}</p>
      <p style={{ margin: 0, color: "#475569" }}>说明：{issue.message}</p>
      <p style={{ margin: 0, color: "#475569" }}>建议：{issue.suggestion}</p>
      <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>
        阶段：{issue.stage}
        {issue.code ? ` | 错误码：${issue.code}` : ""}
        {typeof issue.exitCode === "number" ? ` | Exit Code: ${issue.exitCode}` : ""}
      </p>
      {issue.sample ? (
        <pre
          style={{
            margin: 0,
            padding: 12,
            borderRadius: 8,
            background: "#0f172a",
            color: "#e2e8f0",
            fontSize: 12,
            overflowX: "auto",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {issue.sample}
        </pre>
      ) : null}
    </section>
  );
}
