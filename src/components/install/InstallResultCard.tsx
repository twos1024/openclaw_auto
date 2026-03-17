import { Link } from "react-router-dom";
import type { InstallActionResult } from "../../types/install";

export interface InstallResultCardProps {
  result: InstallActionResult | null;
}

export function InstallResultCard({ result }: InstallResultCardProps): JSX.Element | null {
  if (!result) {
    return null;
  }

  const border =
    result.status === "success" ? "#86efac" : result.status === "warning" ? "#fcd34d" : "#fca5a5";
  const background =
    result.status === "success" ? "#f0fdf4" : result.status === "warning" ? "#fffbeb" : "#fef2f2";
  const nextRoute = result.status === "success" || result.status === "warning" ? "/config" : "/logs";
  const nextLabel = result.status === "success" || result.status === "warning" ? "去配置 API Key" : "查看安装日志";
  const nextHint =
    result.status === "success"
      ? "OpenClaw 已装好，下一步去配置 API Key。"
      : result.status === "warning"
        ? "安装已完成核心部分，先补齐 API Key，再继续启动服务。"
        : "先看日志定位安装问题，再回到安装页重试。";

  return (
    <section
      style={{
        border: `1px solid ${border}`,
        borderRadius: 12,
        background,
        padding: 16,
        display: "grid",
        gap: 8,
      }}
    >
      <strong>
        {result.status === "success"
          ? "安装完成"
          : result.status === "warning"
            ? "安装部分完成"
            : "安装失败"}
      </strong>
      <p style={{ margin: 0 }}>{result.detail}</p>
      <p style={{ margin: 0, fontSize: 13, color: "#475569" }}>建议：{result.suggestion}</p>
      <p style={{ margin: 0, fontSize: 13, color: "#334155" }}>{nextHint}</p>
      <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>当前阶段：{result.stage}</p>
      {result.code ? (
        <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>错误码：{result.code}</p>
      ) : null}
      {result.data?.executablePath ? (
        <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>可执行文件：{result.data.executablePath}</p>
      ) : null}
      {result.data?.notes?.length ? (
        <div style={{ display: "grid", gap: 6 }}>
          {result.data.notes.map((note, index) => (
            <p key={`${index}-${note}`} style={{ margin: 0, fontSize: 12, color: "#475569" }}>
              - {note}
            </p>
          ))}
        </div>
      ) : null}
      <div>
        <Link
          to={nextRoute}
          style={{
            display: "inline-block",
            borderRadius: 8,
            padding: "8px 12px",
            background: "#0f172a",
            color: "#ffffff",
            textDecoration: "none",
            fontWeight: 700,
          }}
        >
          {nextLabel}
        </Link>
      </div>
    </section>
  );
}
