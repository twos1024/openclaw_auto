import type { ErrorHint, ErrorSummaryItem } from "../types/logs";

const ERROR_CODE_MAP: Record<string, Omit<ErrorHint, "id">> = {
  E_PATH_NOT_FOUND: {
    title: "路径不存在",
    message: "系统找不到所需文件或目录。",
    suggestion: "确认安装目录和配置路径是否正确，再重新执行操作。",
    severity: "high",
    code: "E_PATH_NOT_FOUND",
  },
  E_PERMISSION_DENIED: {
    title: "权限不足",
    message: "当前进程没有权限访问目标文件或端口。",
    suggestion: "请以管理员权限运行，或调整文件/目录权限后重试。",
    severity: "high",
    code: "E_PERMISSION_DENIED",
  },
  E_CONFIG_CORRUPTED: {
    title: "配置文件损坏",
    message: "配置文件内容格式异常，无法正常解析。",
    suggestion: "恢复最近备份，或手动修复 JSON/YAML 格式错误。",
    severity: "high",
    code: "E_CONFIG_CORRUPTED",
  },
  E_CONFIG_READ_FAILED: {
    title: "读取配置失败",
    message: "系统读取配置时出现 I/O 错误。",
    suggestion: "检查配置文件是否存在、是否被占用，并确认读取权限。",
    severity: "medium",
    code: "E_CONFIG_READ_FAILED",
  },
  E_CONFIG_WRITE_FAILED: {
    title: "写入配置失败",
    message: "配置保存失败，可能是权限或磁盘问题。",
    suggestion: "检查磁盘可写性与空间，必要时更换配置路径。",
    severity: "high",
    code: "E_CONFIG_WRITE_FAILED",
  },
  E_CONFIG_BACKUP_FAILED: {
    title: "备份配置失败",
    message: "保存前备份步骤失败，为保护数据已中止写入。",
    suggestion: "确认备份目录可写并重试，避免直接覆盖原配置。",
    severity: "high",
    code: "E_CONFIG_BACKUP_FAILED",
  },
  E_PORT_CONFLICT: {
    title: "端口冲突",
    message: "网关目标端口已被其他进程占用。",
    suggestion: "结束占用端口的进程，或改用新的端口后重启网关。",
    severity: "high",
    code: "E_PORT_CONFLICT",
  },
  E_GATEWAY_START_FAILED: {
    title: "网关启动失败",
    message: "OpenClaw Gateway 未能正常启动。",
    suggestion: "检查 startup / gateway 日志，确认 OpenClaw 安装与配置正确。",
    severity: "high",
    code: "E_GATEWAY_START_FAILED",
  },
  E_GATEWAY_STOP_FAILED: {
    title: "网关停止失败",
    message: "ClawDesk 未能停止当前 Gateway 进程。",
    suggestion: "检查是否由其他会话启动，必要时手动结束进程。",
    severity: "medium",
    code: "E_GATEWAY_STOP_FAILED",
  },
  E_GATEWAY_NOT_RUNNING: {
    title: "网关未运行",
    message: "当前没有检测到可控制的 Gateway 进程。",
    suggestion: "先启动 Gateway，或确认服务是否在当前 ClawDesk 会话外运行。",
    severity: "medium",
    code: "E_GATEWAY_NOT_RUNNING",
  },
  E_CMD_TIMEOUT: {
    title: "命令执行超时",
    message: "后端命令在限定时间内未完成。",
    suggestion: "检查网络/进程阻塞情况，或适当增大超时设置。",
    severity: "medium",
    code: "E_CMD_TIMEOUT",
  },
  E_SHELL_TIMEOUT: {
    title: "Shell 命令超时",
    message: "系统命令执行超时，可能卡在子进程启动或网络请求。",
    suggestion: "先检查命令是否可在终端直接执行，再调整超时。",
    severity: "medium",
    code: "E_SHELL_TIMEOUT",
  },
  E_INSTALL_COMMAND_FAILED: {
    title: "安装命令执行失败",
    message: "安装命令已经执行，但返回了非零退出码。",
    suggestion: "检查 npm 输出和安装日志，确认具体失败原因后重试。",
    severity: "high",
    code: "E_INSTALL_COMMAND_FAILED",
  },
  E_NETWORK_FAILED: {
    title: "网络或镜像异常",
    message: "依赖下载失败，通常与 npm registry、代理或网络链路有关。",
    suggestion: "检查 npm registry、代理配置、证书和当前网络连通性后重试。",
    severity: "high",
    code: "E_NETWORK_FAILED",
  },
  E_GATEWAY_INSTALL_FAILED: {
    title: "Gateway 托管安装失败",
    message: "OpenClaw CLI 已安装，但 Gateway 托管服务未能自动注册。",
    suggestion: "前往 Service 与 Logs 页面继续排查托管安装输出或手动完成后续步骤。",
    severity: "medium",
    code: "E_GATEWAY_INSTALL_FAILED",
  },
  EADDRINUSE: {
    title: "端口冲突",
    message: "网关目标端口已被其他进程占用。",
    suggestion: "结束占用端口的进程，或改用新的端口后重启网关。",
    severity: "high",
    code: "EADDRINUSE",
  },
  ECONNREFUSED: {
    title: "连接被拒绝",
    message: "目标服务未监听或网络不可达。",
    suggestion: "确认 OpenClaw Gateway/Ollama 已启动，并检查地址端口。",
    severity: "high",
    code: "ECONNREFUSED",
  },
  HTTP_401: {
    title: "鉴权失败",
    message: "请求被服务端拒绝，通常是 API Key 无效。",
    suggestion: "检查 API Key、权限范围和 Base URL 是否匹配。",
    severity: "high",
    code: "HTTP_401",
  },
  HTTP_404: {
    title: "资源不存在",
    message: "请求的接口或模型不存在。",
    suggestion: "检查模型名称和 API 路径，确认服务版本兼容。",
    severity: "medium",
    code: "HTTP_404",
  },
};

const ERROR_CODE_ALIASES: Record<string, string> = {
  INVALID_INPUT: "E_INVALID_INPUT",
  PATH_NOT_FOUND: "E_PATH_NOT_FOUND",
  PERMISSION_DENIED: "E_PERMISSION_DENIED",
  CONFIG_CORRUPTED: "E_CONFIG_CORRUPTED",
  CONFIG_READ_FAILED: "E_CONFIG_READ_FAILED",
  CONFIG_WRITE_FAILED: "E_CONFIG_WRITE_FAILED",
  CONFIG_BACKUP_FAILED: "E_CONFIG_BACKUP_FAILED",
  SHELL_SPAWN_FAILED: "E_SHELL_SPAWN_FAILED",
  SHELL_TIMEOUT: "E_SHELL_TIMEOUT",
  SHELL_WAIT_FAILED: "E_SHELL_WAIT_FAILED",
  INSTALL_COMMAND_FAILED: "E_INSTALL_COMMAND_FAILED",
  NETWORK_FAILED: "E_NETWORK_FAILED",
  PORT_CONFLICT: "E_PORT_CONFLICT",
  GATEWAY_INSTALL_FAILED: "E_GATEWAY_INSTALL_FAILED",
  GATEWAY_START_FAILED: "E_GATEWAY_START_FAILED",
  GATEWAY_STOP_FAILED: "E_GATEWAY_STOP_FAILED",
  GATEWAY_NOT_RUNNING: "E_GATEWAY_NOT_RUNNING",
  LOG_READ_FAILED: "E_LOG_READ_FAILED",
  DIAGNOSTICS_EXPORT_FAILED: "E_DIAGNOSTICS_EXPORT_FAILED",
  DASHBOARD_OPEN_FAILED: "E_DASHBOARD_OPEN_FAILED",
  CONNECTION_TEST: "E_CONNECTION_TEST",
};

const STDERR_RULES: Array<{
  id: string;
  pattern: RegExp;
  title: string;
  message: string;
  suggestion: string;
  severity: "high" | "medium" | "low";
  code?: string;
}> = [
  {
    id: "port_conflict",
    pattern: /(EADDRINUSE|address already in use|port\s+\d+\s+.*in use)/i,
    title: "端口被占用",
    message: "网关端口冲突，服务无法启动。",
    suggestion: "释放冲突端口后重试，或在配置中更换端口。",
    severity: "high",
    code: "EADDRINUSE",
  },
  {
    id: "conn_refused",
    pattern: /(ECONNREFUSED|connection refused|actively refused)/i,
    title: "服务未启动或不可达",
    message: "目标地址连接失败。",
    suggestion: "先启动对应服务，再检查地址和端口配置。",
    severity: "high",
    code: "ECONNREFUSED",
  },
  {
    id: "permission_denied",
    pattern: /(permission denied|access is denied|operation not permitted)/i,
    title: "权限不足",
    message: "当前进程缺少执行所需权限。",
    suggestion: "提升权限或调整目录/端口权限设置。",
    severity: "high",
    code: "E_PERMISSION_DENIED",
  },
  {
    id: "path_missing",
    pattern: /(ENOENT|No such file or directory|not found)/i,
    title: "文件或命令不存在",
    message: "依赖文件或可执行程序未找到。",
    suggestion: "检查安装路径和环境变量，确认二进制已安装。",
    severity: "high",
    code: "E_PATH_NOT_FOUND",
  },
  {
    id: "auth_error",
    pattern: /(401|unauthorized|invalid api key|forbidden)/i,
    title: "认证失败",
    message: "访问上游服务时鉴权失败。",
    suggestion: "确认 API Key、Token 权限以及请求头格式。",
    severity: "high",
    code: "HTTP_401",
  },
  {
    id: "model_not_found",
    pattern: /(model.*not found|unknown model|404)/i,
    title: "模型不存在或路径错误",
    message: "目标模型或接口路径无效。",
    suggestion: "检查模型名称、部署状态和 API 路由。",
    severity: "medium",
    code: "HTTP_404",
  },
  {
    id: "network_failure",
    pattern: /(ENOTFOUND|ECONNRESET|socket hang up|registry\.npmjs\.org|network request failed|self signed certificate|proxy)/i,
    title: "网络或镜像异常",
    message: "依赖下载或远程请求失败。",
    suggestion: "检查网络、代理、镜像源和证书配置后重试。",
    severity: "high",
    code: "E_NETWORK_FAILED",
  },
  {
    id: "timeout",
    pattern: /(timeout|timed out|deadline exceeded)/i,
    title: "请求超时",
    message: "操作耗时超过限制。",
    suggestion: "适当增加超时时间，并排查网络或服务负载。",
    severity: "medium",
    code: "E_CMD_TIMEOUT",
  },
];

function createHintFromCode(code: string): ErrorHint | null {
  const rawCode = code.trim().toUpperCase();
  const normalized = ERROR_CODE_ALIASES[rawCode] ?? rawCode;
  const mapped = ERROR_CODE_MAP[normalized];
  if (!mapped) return null;

  return {
    id: `code_${normalized}`,
    ...mapped,
  };
}

function createHintFromRule(line: string): ErrorHint | null {
  for (const rule of STDERR_RULES) {
    if (rule.pattern.test(line)) {
      return {
        id: `rule_${rule.id}`,
        title: rule.title,
        message: rule.message,
        suggestion: rule.suggestion,
        severity: rule.severity,
        code: rule.code,
      };
    }
  }
  return null;
}

export function mapErrorCode(code?: string | null): ErrorHint | null {
  if (!code) return null;
  return createHintFromCode(code);
}

export function mapStderr(stderr: string): ErrorHint | null {
  return createHintFromRule(stderr);
}

function normalizeLine(line: string): string {
  return line.replace(/\s+/g, " ").trim();
}

function severityRank(severity: ErrorHint["severity"]): number {
  if (severity === "high") return 3;
  if (severity === "medium") return 2;
  return 1;
}

function findErrorCodeInLine(line: string): string | null {
  const matched = line.match(
    /\b(E_[A-Z0-9_]+|[A-Z]+(?:_[A-Z0-9]+)+|EADDRINUSE|ECONNREFUSED|HTTP_\d{3})\b/i,
  );
  return matched ? matched[1].toUpperCase() : null;
}

export function extractErrorSummaries(lines: string[]): ErrorSummaryItem[] {
  const table = new Map<string, ErrorSummaryItem>();

  for (const raw of lines) {
    const line = normalizeLine(raw);
    if (!line) continue;

    const code = findErrorCodeInLine(line);
    const codeHint = code ? createHintFromCode(code) : null;
    const mapped = codeHint ?? createHintFromRule(line);

    const fallback =
      !mapped && /(error|failed|panic|exception|fatal)/i.test(line)
        ? {
            id: "rule_generic_error",
            title: "通用运行错误",
            message: "日志包含未映射的错误信息。",
            suggestion: "查看完整日志上下文并补充 errorMap 规则。",
            severity: "low" as const,
            code: undefined,
          }
        : null;

    const finalHint = mapped ?? fallback;
    if (!finalHint) continue;

    const existing = table.get(finalHint.id);
    if (!existing) {
      table.set(finalHint.id, {
        ...finalHint,
        count: 1,
        samples: [line],
      });
      continue;
    }

    existing.count += 1;
    if (existing.samples.length < 3 && !existing.samples.includes(line)) {
      existing.samples.push(line);
    }
  }

  return [...table.values()].sort((a, b) => {
    const sev = severityRank(b.severity) - severityRank(a.severity);
    if (sev !== 0) return sev;
    return b.count - a.count;
  });
}
