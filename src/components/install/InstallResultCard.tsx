import { Link } from "react-router-dom";
import type { InstallActionResult } from "../../types/install";

export interface InstallResultCardProps {
  result: InstallActionResult | null;
}

export function InstallResultCard({ result }: InstallResultCardProps): JSX.Element | null {
  if (!result) {
    return null;
  }

  const isSuccess = result.status === "success";
  const isWarning = result.status === "warning";
  const isOk = isSuccess || isWarning;

  const border = isSuccess ? "#86efac" : isWarning ? "#fcd34d" : "#fca5a5";
  const background = isSuccess ? "#f0fdf4" : isWarning ? "#fffbeb" : "#fef2f2";
  const nextRoute = isOk ? "/config" : "/logs";
  const nextLabel = isOk ? "下一步：配置 API Key" : "查看详细日志";

  const title = isSuccess ? "安装完成" : isWarning ? "安装基本完成" : "安装遇到问题";
  const hint = isSuccess
    ? "OpenClaw 已就绪，下一步去填入 API Key，然后就可以启动服务了。"
    : isWarning
      ? "核心组件已安装成功，先填写 API Key，后续可在服务页面继续处理剩余步骤。"
      : "安装过程中出现了问题，可以查看日志了解详情，修复后重新安装。";

  return (
    <section
      style={{
        border: `1px solid ${border}`,
        borderRadius: 12,
        background,
        padding: 16,
        display: "grid",
        gap: 10,
      }}
    >
      <strong style={{ fontSize: 15 }}>{title}</strong>
      <p style={{ margin: 0, color: "#334155" }}>{result.detail}</p>
      <p style={{ margin: 0, fontSize: 13, color: "#475569" }}>{hint}</p>
      <div>
        <Link
          to={nextRoute}
          style={{
            display: "inline-block",
            borderRadius: 8,
            padding: "9px 14px",
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
