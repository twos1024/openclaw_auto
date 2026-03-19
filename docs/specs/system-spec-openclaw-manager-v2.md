# OpenClaw Manager v2.0 — System SPEC

> 完整系统行为规格说明。定义状态机、IPC 合约、数据模型、进程生命周期、
> 错误处理策略和测试边界条件。所有实现必须满足本文档中的约束。
>
> 日期：2026-03-19
> 前置文档：prd-openclaw-manager-v2.md, tech-architecture-openclaw-manager-v2.md

---

## 1. 术语表

| 术语 | 定义 |
|------|------|
| Manager | OpenClaw Manager 桌面应用（Tauri shell + WebView 前端） |
| Gateway | openclaw 启动的持久化 Node.js HTTP 代理服务 |
| CLI | 全局安装的 `openclaw` / `openclaw.cmd` 命令行工具 |
| Instance | 用户创建的 AI Bot 实例，绑定 Prompt + 模型 + 渠道 |
| IPC | Tauri invoke 桥接，前端 → Rust → 前端的双向调用 |
| APIMart | 第三方 API Key 供应商，提供多模型统一接入和计费 |

---

## 2. 系统状态机

### 2.1 应用生命周期状态机

```
                    ┌───────────┐
                    │  LAUNCH   │
                    └─────┬─────┘
                          │ Tauri main() 初始化
                          ▼
                    ┌───────────┐
               ┌────│   BOOT    │────┐
               │    └─────┬─────┘    │
               │          │          │
         WebView 加载失败   │     IPC 桥接失败
               │          │          │
               ▼          ▼          ▼
        ┌──────────┐ ┌─────────┐ ┌──────────────┐
        │  FATAL   │ │  READY  │ │ DEGRADED     │
        │ (白屏)   │ │ (正常)  │ │ (preview模式) │
        └──────────┘ └────┬────┘ └──────────────┘
                          │
                   用户关闭窗口
                          │
                          ▼
                    ┌───────────┐
                    │  CLEANUP  │  ← 清理所有子进程
                    └─────┬─────┘
                          │
                          ▼
                    ┌───────────┐
                    │   EXIT    │
                    └───────────┘
```

**BOOT 阶段约束：**
- 必须在 3 秒内完成 WebView 加载并渲染首屏
- IPC 桥接检测优先使用 `@tauri-apps/api/core`，回退到 `window.__TAURI__`
- 若两者均不可用，进入 `browser-preview` 模式（所有 IPC 命令返回模拟数据）

**CLEANUP 阶段约束：**
- 必须终止所有由 `run_command()` 产生的子进程
- Windows 上使用 `taskkill /F /T /PID` 杀整个进程树
- Gateway 服务不在此阶段停止（它是独立守护进程）

### 2.2 Gateway 服务状态机

```
                ┌──────────┐
                │ UNKNOWN  │  ← 初始状态（首次打开、尚未查询）
                └────┬─────┘
                     │ get_gateway_status
                     ▼
           ┌─────────────────────┐
     ┌─────│     STOPPED         │◀──────────────────┐
     │     └─────────┬───────────┘                    │
     │               │ start_gateway                   │
     │               ▼                                 │
     │     ┌─────────────────────┐                    │
     │     │     STARTING        │                    │
     │     └─────────┬───────────┘                    │
     │               │                                │
     │         ┌─────┴─────┐                          │
     │         ▼           ▼                          │
     │  ┌───────────┐ ┌──────────┐                    │
     │  │  RUNNING  │ │  ERROR   │────────────────────┤
     │  └─────┬─────┘ └──────────┘                    │
     │        │                                        │
     │        │ stop_gateway                           │
     │        ▼                                        │
     │  ┌───────────┐                                  │
     │  │ STOPPING  │─────────────────────────────────┘
     │  └───────────┘
     │
     │  restart_gateway = stop → start (原子操作)
     │
     │  端口冲突
     └──▶ ┌──────────────┐
          │ PORT_CONFLICT │  ← 特殊 ERROR 子状态
          └──────────────┘
```

**状态转换规则：**

| 当前状态 | 触发动作 | 目标状态 | 前置条件 |
|----------|----------|----------|----------|
| UNKNOWN | `get_gateway_status` 成功 | RUNNING / STOPPED | CLI 可用 |
| UNKNOWN | `get_gateway_status` 失败 | ERROR | - |
| STOPPED | `start_gateway` | STARTING → RUNNING | CLI 可用 + 端口空闲 |
| STOPPED | `start_gateway` 端口冲突 | PORT_CONFLICT | 端口被占 |
| RUNNING | `stop_gateway` | STOPPING → STOPPED | PID 存在 |
| RUNNING | `restart_gateway` | STOPPING → STARTING → RUNNING | - |
| ERROR | `start_gateway` | STARTING → RUNNING / ERROR | - |
| 任意 | CLI 不存在 | ERROR (E_PATH_NOT_FOUND) | - |

**轮询约束：**
- 默认间隔：`5000ms`（可通过 Settings 调整，范围 `1000-60000ms`）
- 轮询只调用 `get_gateway_status`，绝不调用 `start_gateway`
- 每次轮询产生的 CLI 子进程必须在 `30s` 超时后强制 kill
- 组件卸载后，不得再创建新的 interval（修复 v1.0.70 竞态条件）

### 2.3 实例生命周期状态机

```
  ┌──────────┐
  │  DRAFT   │  ← 向导创建中（Step 1-4），尚未保存
  └────┬─────┘
       │ 完成向导 Step 4
       ▼
  ┌──────────┐    start     ┌──────────┐
  │  CREATED │─────────────▶│  ACTIVE  │
  │ (已保存)  │◀─────────────│ (运行中)  │
  └────┬─────┘    stop      └────┬─────┘
       │                          │
       │ delete                   │ delete (需先 stop)
       ▼                          ▼
  ┌──────────┐             ┌──────────┐
  │ ARCHIVED │             │ ARCHIVED │
  └──────────┘             └──────────┘
```

**实例数据模型：**

```typescript
interface Instance {
  // --- 身份 ---
  id: string;              // UUID v4，创建时生成
  displayName: string;     // 用户填写的显示名称（Step 1）
  systemPrompt: string;    // System Prompt / 人设（Step 2）

  // --- 模型 ---
  modelId: string;         // 模型标识符，如 "gpt-5.3-codex"
  modelName: string;       // 模型显示名，如 "GPT-5.3 Codex"
  modelParams: {
    temperature: number;   // 0.0 - 2.0，默认 0.7
    maxTokens: number;     // 模型最大输出 token
    topP: number;          // 0.0 - 1.0，默认 1.0
  };

  // --- 渠道 ---
  channelType: "apimart" | "openai-compatible" | "custom";
  apiKeyRef: string;       // API Key 引用 ID（不存明文 Key）
  baseUrl: string;         // API 端点地址

  // --- 元数据 ---
  status: "created" | "active" | "archived";
  createdAt: string;       // ISO 8601
  updatedAt: string;       // ISO 8601
  lastActiveAt: string | null;
  totalTokensUsed: number;
  totalConversations: number;
}
```

---

## 3. IPC 合约规格

### 3.1 通用信封

所有 IPC 命令返回统一信封格式：

```typescript
// 成功
{
  success: true,
  data: T
}

// 失败
{
  success: false,
  error: {
    code: ErrorCode,      // 枚举字符串，如 "E_PORT_CONFLICT"
    message: string,      // 人类可读的错误描述
    suggestion: string,   // 建议的修复操作
    details?: object      // 可选的调试上下文
  }
}
```

**前端处理规则：**
- `success: true` → 读取 `data`，类型由命令决定
- `success: false` → 读取 `error`，显示 `message`，行动指引取 `suggestion`
- IPC 调用本身抛异常 → 包装为 `E_INVOKE` 错误码

### 3.2 命令合约清单

#### 3.2.1 环境检测

```
命令:     detect_env
入参:     无
返回:     DetectEnvData
超时:     5s (npm --version) + 5s (where/which) + 5s (openclaw --version)
副作用:   无
幂等性:   是
```

```typescript
interface DetectEnvData {
  platform: string;             // "windows-x86_64" | "macos-aarch64" | ...
  architecture: string;         // "x86_64" | "aarch64"
  homeDir: string | null;       // %USERPROFILE% 或 $HOME
  configPath: string;           // openclaw 配置文件路径
  npmFound: boolean;
  npmVersion: string | null;    // "10.2.0"
  npmOutput: ShellOutput | null;
  openclawFound: boolean;
  openclawPath: string | null;  // 完整可执行文件路径
  openclawVersion: string | null;
  locatorOutput: ShellOutput | null;
  versionOutput: ShellOutput | null;
}
```

#### 3.2.2 Gateway 控制

```
命令:     get_gateway_status
入参:     无
返回:     GatewayStatusData
超时:     30s
副作用:   无（只读查询）
幂等性:   是
轮询安全: 是
```

```typescript
interface GatewayStatusData {
  state: "running" | "stopped" | "starting" | "stopping" | "error";
  running: boolean;
  port: number;              // 默认 3000 或 4317
  address: string;           // "http://127.0.0.1:{port}"
  pid: number | null;        // 网关进程 PID
  lastStartedAt: string | null; // ISO 8601
  statusDetail: string;      // 人类可读状态描述
  suggestion: string;        // 下一步建议
  portConflictPort: number | null; // 冲突端口号
}
```

```
命令:     start_gateway
入参:     无
返回:     GatewayActionData
超时:     30s
副作用:   启动 Node.js 网关进程
幂等性:   否（重复调用可能端口冲突）
```

```
命令:     stop_gateway
入参:     无
返回:     GatewayActionData
超时:     30s
副作用:   停止 Node.js 网关进程
幂等性:   是（已停止则 noop）
```

```
命令:     restart_gateway
入参:     无
返回:     GatewayActionData
超时:     30s
副作用:   stop + start 原子操作
幂等性:   否
```

```typescript
interface GatewayActionData {
  detail: string;
  address: string | null;
  pid: number | null;
}
```

#### 3.2.3 实例管理（v2.0 新增）

```
命令:     list_instances
入参:     { search?: string, status?: InstanceStatus }
返回:     InstanceListData
超时:     5s
副作用:   无
幂等性:   是
```

```
命令:     create_instance
入参:     CreateInstancePayload
返回:     Instance
超时:     10s
副作用:   写入实例配置到 Gateway
幂等性:   否
```

```
命令:     update_instance
入参:     { id: string, patch: Partial<InstanceConfig> }
返回:     Instance
超时:     10s
副作用:   更新 Gateway 实例配置
幂等性:   是
```

```
命令:     delete_instance
入参:     { id: string }
返回:     { deleted: boolean }
超时:     10s
副作用:   删除实例，自动停止运行中实例
幂等性:   是
```

```typescript
interface CreateInstancePayload {
  displayName: string;     // Step 1
  systemPrompt: string;    // Step 2
  modelId: string;         // Step 3
  channelType: string;     // Step 4
  apiKeyRef: string;       // Step 4
  baseUrl: string;         // Step 4
}

interface InstanceListData {
  instances: Instance[];
  total: number;
  running: number;
}
```

#### 3.2.4 AI 对话（v2.0 新增）

```
命令:     send_chat_message
入参:     ChatMessagePayload
返回:     SSE 流式事件（通过 Tauri Event 推送）
超时:     300s（长对话）
副作用:   消耗 Token，写入对话历史
幂等性:   否
```

```typescript
interface ChatMessagePayload {
  instanceId: string | null;  // null = 使用临时实例
  conversationId: string;     // 会话 ID
  content: string;            // 用户消息
  mode: "llm" | "agent";     // 对话模式
  modelOverride?: string;     // 覆盖实例模型
}

// 流式事件 (Tauri Event)
type ChatStreamEvent =
  | { type: "delta"; content: string }           // 增量文本
  | { type: "tool_call"; name: string; args: string } // Agent 工具调用
  | { type: "tool_result"; content: string }     // 工具返回
  | { type: "done"; usage: TokenUsage }          // 完成
  | { type: "error"; code: string; message: string }; // 错误

interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost: number;  // 单位：美分
}
```

#### 3.2.5 Token 用量

```
命令:     query_token_usage
入参:     { apiKey: string, days?: number }
返回:     TokenUsageData
超时:     15s（需外部 API 调用）
副作用:   无
幂等性:   是
```

```typescript
interface TokenUsageData {
  balance: number;           // 剩余余额（美元）
  totalUsed: number;         // 总消耗 Token 数
  dailyBreakdown: Array<{
    date: string;            // "2026-03-19"
    tokens: number;
    cost: number;
  }>;
  byModel: Array<{
    model: string;
    tokens: number;
    cost: number;
  }>;
  byInstance: Array<{
    instanceId: string;
    instanceName: string;
    tokens: number;
    cost: number;
  }>;
}
```

---

## 4. 进程管理规格

### 4.1 子进程生命周期

```
Manager (Rust 主进程)
  │
  ├── spawn ──▶ openclaw.cmd gateway status --json
  │              │
  │              ├── 正常退出 (exit 0) → 解析 JSON → 返回状态
  │              ├── 异常退出 (exit ≠ 0) → 解析 stderr → 返回错误
  │              └── 超时 (>30s) → kill_on_drop + taskkill /F /T → 返回 E_SHELL_TIMEOUT
  │
  ├── spawn ──▶ openclaw.cmd gateway start --json
  │              │
  │              ├── 正常退出 → Gateway 进程已作为守护进程分离
  │              └── 端口冲突 → stderr 含 EADDRINUSE → 返回 E_PORT_CONFLICT
  │
  └── spawn ──▶ npm.cmd install -g openclaw@latest
                 │
                 ├── 正常退出 → CLI 安装成功
                 └── 超时 (>10min) → kill 进程树 → 返回 E_SHELL_TIMEOUT
```

### 4.2 进程隔离约束

| 约束项 | 规格 |
|--------|------|
| 窗口可见性 | 所有 `run_command` 子进程必须设置 `CREATE_NO_WINDOW` (Windows) |
| kill_on_drop | 所有子进程必须设置 `kill_on_drop(true)` |
| 进程树清理 | Windows 超时时使用 `taskkill /F /T /PID` 杀整棵进程树 |
| PATH 注入 | `run_command` 必须注入 `platform::normalized_path_env()` 确保找到 npm/node |
| 并发限制 | 同一时刻最多 3 个 CLI 子进程（防止轮询风暴） |
| Gateway 独立 | Gateway 守护进程不随 Manager 退出而停止 |

### 4.3 前端轮询规格

```typescript
/**
 * 轮询生命周期约束（修复 v1.0.70 竞态条件后）
 *
 * 不变量:
 *   1. 每个 useGatewayControl 实例最多维持 1 个活跃 interval
 *   2. 组件卸载后不得创建新 interval
 *   3. 组件卸载后不得调用任何 setState
 *   4. 轮询 interval 必须在 cleanup 函数中被 clearInterval
 */

// 正确模式:
useEffect(() => {
  let timer: number | null = null;
  unmountedRef.current = false;

  const init = async () => {
    await fetchStatus();
    // ✅ 必须在 await 之后检查 unmountedRef
    if (!unmountedRef.current) {
      timer = setInterval(poll, intervalMs);
    }
  };

  init();

  return () => {
    unmountedRef.current = true;
    if (timer !== null) clearInterval(timer);
  };
}, [intervalMs]);
```

---

## 5. 错误码体系

### 5.1 错误码注册表

| 错误码 | 分类 | 来源 | 含义 | 用户可见建议 |
|--------|------|------|------|-------------|
| `E_INVALID_INPUT` | 输入 | 前端/Rust | 参数校验失败 | 检查输入值格式 |
| `E_PATH_NOT_FOUND` | 环境 | Rust | CLI 可执行文件不存在 | 运行安装流程 |
| `E_PERMISSION_DENIED` | 环境 | Rust | 文件/进程权限不足 | 以管理员权限运行 |
| `E_SHELL_SPAWN_FAILED` | 进程 | Rust | 子进程启动失败 | 检查 PATH 环境变量 |
| `E_SHELL_TIMEOUT` | 进程 | Rust | 子进程执行超时 | 检查网络或进程阻塞 |
| `E_SHELL_WAIT_FAILED` | 进程 | Rust | 等待子进程输出失败 | 重试或检查系统资源 |
| `E_PORT_CONFLICT` | 网关 | Rust | 端口已被占用 | 释放端口或更换端口 |
| `E_GATEWAY_START_FAILED` | 网关 | Rust | 网关启动失败 | 查看日志定位原因 |
| `E_GATEWAY_STATUS_FAILED` | 网关 | Rust | 网关状态查询失败 | 检查 CLI 是否正确安装 |
| `E_GATEWAY_STOP_FAILED` | 网关 | Rust | 网关停止失败 | 手动 kill 进程 |
| `E_GATEWAY_NOT_RUNNING` | 网关 | Rust | 网关未运行 | 先启动网关 |
| `E_CONFIG_CORRUPTED` | 配置 | Rust | 配置文件损坏 | 重新填写配置 |
| `E_CONFIG_READ_FAILED` | 配置 | Rust | 配置文件读取失败 | 检查文件权限 |
| `E_CONFIG_WRITE_FAILED` | 配置 | Rust | 配置文件写入失败 | 检查磁盘空间和权限 |
| `E_NETWORK_FAILED` | 网络 | Rust | 网络请求失败 | 检查网络连接 |
| `E_INSTALL_COMMAND_FAILED` | 安装 | Rust | 安装命令失败 | 检查 npm 和网络 |
| `E_LOG_READ_FAILED` | 日志 | Rust | 日志文件读取失败 | 检查日志目录权限 |
| `E_INVOKE` | IPC | 前端 | Tauri IPC 调用失败 | 重启应用 |
| `E_PREVIEW_MODE` | 运行时 | 前端 | 浏览器预览模式 | 使用桌面端运行 |
| `E_TAURI_UNAVAILABLE` | 运行时 | 前端 | Tauri 桥接不可用 | 重装应用 |

### 5.2 错误传播链

```
用户操作
  │
  ▼
前端 Hook (useGatewayControl)
  │ try/catch → safeRun() 吞掉异常，返回 null
  │
  ▼
前端 Service (serviceService)
  │ 检查 RuntimeMode
  │   ├─ browser-preview → 返回模拟数据
  │   ├─ tauri-runtime-unavailable → 返回运行时错误
  │   └─ tauri-runtime-available → 调用 IPC
  │
  ▼
tauriClient.invokeCommand<T>()
  │ 获取 invoke 函数
  │   ├─ 无 invoke → 返回 { success: false, error: E_PREVIEW_MODE }
  │   └─ 有 invoke → 调用 Rust 命令
  │ catch → 返回 { success: false, error: E_INVOKE }
  │
  ▼
Rust Command (#[tauri::command])
  │ 调用 Service 层
  │
  ▼
Rust Service (gateway_service)
  │ 调用 Adapter 层
  │ 错误映射: AppError { code, message, suggestion, details }
  │
  ▼
Rust Adapter (shell::run_command)
  │ spawn 子进程
  │   ├─ spawn 失败 → E_SHELL_SPAWN_FAILED
  │   ├─ 超时 → kill 进程树 → E_SHELL_TIMEOUT
  │   ├─ wait 失败 → E_SHELL_WAIT_FAILED
  │   └─ 正常退出 → ShellOutput { stdout, stderr, exit_code }
  │
  ▼
CLI 子进程 (openclaw gateway status --json)
  │ exit 0 → JSON stdout
  │ exit ≠ 0 → stderr 含错误信息
  │   ├─ EADDRINUSE → 上层映射为 E_PORT_CONFLICT
  │   └─ 其他 → 上层映射为 E_GATEWAY_*
```

### 5.3 端口冲突检测规格

```
检测输入:  ShellOutput.stdout + ShellOutput.stderr（拼接后转小写）
检测关键词: "address already in use" | "eaddrinuse" | "port conflict"
端口提取:
  1. 优先: 匹配 "port " 后的数字
  2. 回退: 匹配最后一个 ":" 后的数字
返回:     ErrorCode::PortConflict + conflict_port: Option<u16>
```

---

## 6. 数据存储规格

### 6.1 文件布局

```
%APPDATA%/openclaw/         (Windows)
~/.config/openclaw/         (macOS/Linux)
  │
  ├── config.json           ← OpenClaw 网关配置（API Key、模型、端口）
  ├── config.json.bak       ← 配置备份
  │
  ├── instances/            ← v2.0 新增：实例存储
  │   ├── {uuid}.json       ← 单个实例配置
  │   └── ...
  │
  ├── conversations/        ← v2.0 新增：对话历史
  │   ├── {uuid}/
  │   │   ├── meta.json     ← 会话元数据
  │   │   └── messages.jsonl ← 消息流（JSONL 格式，追加写入）
  │   └── ...
  │
  └── logs/
      ├── gateway.log       ← 网关日志
      ├── install.log       ← 安装日志
      └── startup.log       ← 启动日志

%APPDATA%/clawdesk/         (Windows)
~/.config/clawdesk/         (macOS/Linux)
  │
  ├── settings.json         ← ClawDesk 应用设置
  ├── keys.enc              ← v2.0 新增：加密的 API Key 存储
  └── diagnostics/          ← 诊断导出目录
```

### 6.2 API Key 安全存储规格（v2.0 新增）

```
存储格式:     加密 JSON（AES-256-GCM）
密钥派生:     PBKDF2(machine_id + user_sid, salt, 100000 rounds)
文件位置:     %APPDATA%/clawdesk/keys.enc
内存中:       仅在 IPC 调用时解密，用完立即 zeroize
日志中:       绝不写入明文 Key（只写 "sk-...xxxx" 掩码形式）
前端中:       前端只持有 keyRef（引用 ID），不持有明文
```

```typescript
interface ApiKeyEntry {
  id: string;           // UUID，前端引用用
  label: string;        // 用户命名，如 "我的 APIMart Key"
  provider: string;     // "apimart" | "openai" | "custom"
  maskedKey: string;    // "sk-...a3f2" 掩码显示
  createdAt: string;
}

// 前端永远看不到明文 Key，只操作 ApiKeyEntry
```

### 6.3 对话历史存储规格（v2.0 新增）

```
格式:   JSONL（每行一个 JSON 对象），追加写入
限制:   单会话最大 50MB，超过自动截断旧消息
索引:   meta.json 存会话元数据，避免加载全量消息

meta.json:
{
  "id": "conv-uuid",
  "instanceId": "inst-uuid",
  "title": "自动摘要或用户命名",
  "model": "gpt-5.3-codex",
  "messageCount": 42,
  "createdAt": "...",
  "updatedAt": "...",
  "totalTokens": 12345
}

messages.jsonl (每行):
{"role":"user","content":"...","timestamp":"..."}
{"role":"assistant","content":"...","timestamp":"...","usage":{...}}
{"role":"tool","name":"...","content":"...","timestamp":"..."}
```

---

## 7. 总览状态聚合规格

### 7.1 健康等级定义

| 等级 | 语义 | 颜色 | 图标 |
|------|------|------|------|
| `healthy` | 一切正常 | 绿色 #22C55E | ● |
| `degraded` | 功能可用但需要注意 | 橙色 #F59E0B | ▲ |
| `offline` | 功能不可用 | 红色 #EF4444 | ✕ |
| `unknown` | 无法判定 | 灰色 #94A3B8 | ? |

### 7.2 总体健康等级计算

```
overall = worst(runtime, install, config, service, settings)

排序: offline (4) > degraded (3) > unknown (2) > healthy (1)
```

### 7.3 引导式下一步

```
if install ≠ healthy → "下一步：安装 OpenClaw"
else if config ≠ healthy → "下一步：填写 API Key"
else if service ≠ healthy → "下一步：启动 Gateway"
else → "可以开始使用了"
```

---

## 8. 国际化规格

### 8.1 支持语言

| 代码 | 语言 | 覆盖率要求 |
|------|------|-----------|
| `zh-CN` | 简体中文 | 100%（主语言） |
| `en` | English | 100% |
| `ja` | 日本語 | 100% |

### 8.2 实现方式

```
方案:      react-i18next + JSON namespace 文件
切换:      侧边栏底部语言选择器，即时生效，无需重启
存储:      选择结果持久化到 settings.json
回退链:    用户选择 → 浏览器语言 → zh-CN
```

### 8.3 翻译键命名规范

```
{page}.{section}.{element}

示例:
  instances.header.title         → "实例管理"
  instances.empty.message        → "还没有实例。"
  instances.wizard.step1.label   → "名称"
  chat.input.placeholder         → "输入消息..."
  gateway.status.running         → "Gateway 正在运行"
  token.balance.label            → "剩余余额"
```

---

## 9. 性能约束

| 指标 | 目标值 | 测量方法 |
|------|--------|----------|
| 冷启动首屏 | < 2s | Tauri main() → WebView 渲染完成 |
| IPC 命令延迟 | < 100ms（纯 Rust 命令） | invoke → 返回结果 |
| CLI 命令延迟 | < 3s（gateway status） | invoke → spawn → exit → 返回 |
| 实例列表渲染 | < 500ms（1000 条） | 虚拟滚动 + React.memo |
| 对话首 token | < 1s（取决于模型） | 发送消息 → 收到第一个 delta |
| 空闲内存 | < 200MB | 无活跃操作时的 RSS |
| 轮询开销 | < 1% CPU | 5s 间隔轮询时的 CPU 占用 |
| 安装包大小 | < 80MB | Windows x64 .exe |

---

## 10. 测试规格

### 10.1 单元测试边界

| 模块 | 测试场景 | 断言 |
|------|----------|------|
| `gateway_service` | 嵌套 JSON 解析 | 从任意层级提取 running/port/pid |
| `gateway_service` | EADDRINUSE 检测 | 正确识别端口冲突 + 提取冲突端口 |
| `gateway_service` | 空 stdout 处理 | 返回合理默认值而非 panic |
| `overview_service` | 健康等级聚合 | worst() 计算正确 |
| `overview_service` | 引导式下一步 | install 优先于 config 优先于 service |
| `shell` | 超时处理 | 超时后进程树被 kill |
| `useGatewayControl` | 组件卸载竞态 | 卸载后不创建 interval |
| `useGatewayControl` | 并发操作锁 | 同一 action 不可重入 |
| `serviceService` | 预览模式降级 | browser-preview 返回模拟数据 |
| `tauriClient` | IPC 桥接检测 | 正确区分三种运行时模式 |

### 10.2 集成测试场景

| 编号 | 场景 | 步骤 | 预期 |
|------|------|------|------|
| IT-01 | 完整安装流程 | 无 CLI → 安装 → 验证 → 配置 → 启动 | Gateway running |
| IT-02 | 端口冲突恢复 | 占用端口 → start → 失败 → 释放 → start → 成功 | 最终 running |
| IT-03 | 进程清理 | 启动多个 CLI 命令 → 关闭 Manager | 无残留 node 进程 |
| IT-04 | 实例 CRUD | 创建 → 列表显示 → 编辑 → 删除 | 数据一致 |
| IT-05 | 对话流式 | 发送消息 → 接收 delta → done | 完整渲染 |

### 10.3 E2E 测试场景

| 编号 | 场景 | 用户操作 | 验证点 |
|------|------|----------|--------|
| E2E-01 | 首次引导 | 打开 → 看到安装引导 → 安装 → 配置 → 启动 | 全流程无阻塞 |
| E2E-02 | 快速导航 | 快速切换 Service ↔ Logs 页面 10 次 | 无 interval 泄露 |
| E2E-03 | 创建实例 | 点击新建 → 4 步向导 → 完成 | 实例出现在列表 |
| E2E-04 | 对话验证 | 选模型 → 输入消息 → 等待回复 | 流式输出显示 |
| E2E-05 | 语言切换 | 切换到 English → 切换到日本語 → 切回中文 | 所有文字更新 |
| E2E-06 | Token 查询 | 输入 API Key → 点击查询 | 显示余额和用量 |
| E2E-07 | 内存泄露 | 运行 30 分钟，每 10s 切换页面 | RSS 增长 < 50MB |

---

## 11. 安全约束

| 编号 | 约束 | 检查方式 |
|------|------|----------|
| S-01 | API Key 不得以明文存入磁盘 | 代码审查 + grep "sk-" |
| S-02 | API Key 不得出现在日志中 | 日志输出全部掩码化 |
| S-03 | 子进程命令注入防护 | `Command::new()` + `.args()` 分离，不用 shell 拼接 |
| S-04 | WebView 不加载外部 URL | CSP 策略限制 origin |
| S-05 | IPC 命令不暴露文件系统任意读写 | 所有路径参数限制在已知目录 |
| S-06 | Gateway 仅监听 127.0.0.1 | 不绑定 0.0.0.0 |
| S-07 | 更新检查使用 HTTPS | 不接受 HTTP 降级 |

---

## 12. 版本兼容性

### 12.1 CLI ↔ Manager 版本矩阵

```
Manager 通过 JSON 输出解析 CLI 响应，必须兼容以下差异：

JSON 字段名不固定:
  running / isRunning / active        → 均识别为 "是否运行"
  port / gatewayPort                  → 均识别为 "端口"
  pid / processId                     → 均识别为 "进程 ID"
  address / url / dashboardUrl        → 均识别为 "地址"

字段值类型不固定:
  port: 3000 (number) 或 "3000" (string) → 均解析为 u16
  running: true (bool) 或 "running" (string) → 均解析为 bool

嵌套层级不固定:
  { "running": true }                 → 顶层
  { "gateway": { "active": true } }   → 嵌套一层
  → find_key_recursive 递归搜索，适配任意嵌套
```

### 12.2 数据迁移

```
v1.x → v2.0:
  - settings.json: 新增字段使用默认值，不破坏已有字段
  - config.json: 向后兼容，仅追加字段
  - 实例数据: v1.x 无实例概念，v2.0 从零开始
  - 对话数据: v1.x 无对话历史，v2.0 从零开始
```
