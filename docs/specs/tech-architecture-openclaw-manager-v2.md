# OpenClaw Manager v2.0 — 技术架构文档

> 基于 v1.0.70 截图与 ClawDesk 源码分析，输出重构版技术架构。
> 日期：2026-03-19

---

## 1. 架构总览

```
┌─────────────────────────────────────────────────────────────┐
│                      OpenClaw Manager                        │
│                     (Tauri 2.x 桌面应用)                      │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │                    Frontend (WebView)                   │  │
│  │                                                        │  │
│  │  ┌──────────┐  ┌──────────┐  ┌───────────────────┐    │  │
│  │  │ React 18 │  │ React    │  │  Service Layer    │    │  │
│  │  │ Pages &  │  │ Router   │  │  (tauriClient.ts) │    │  │
│  │  │ Components│  │          │  │                   │    │  │
│  │  └────┬─────┘  └──────────┘  └────────┬──────────┘    │  │
│  │       │                                │               │  │
│  │  ┌────▼────────────────────────────────▼──────────┐    │  │
│  │  │              Custom Hooks Layer                 │    │  │
│  │  │  useGatewayControl  useInstallFlow  useLogs    │    │  │
│  │  │  useRunbook  useConfigForm  useSettingsForm    │    │  │
│  │  └────────────────────┬───────────────────────────┘    │  │
│  │                       │ invoke()                       │  │
│  └───────────────────────┼────────────────────────────────┘  │
│                          │ Tauri IPC Bridge                   │
│  ┌───────────────────────▼────────────────────────────────┐  │
│  │                    Backend (Rust)                       │  │
│  │                                                        │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐     │  │
│  │  │ Commands │  │ Services │  │    Adapters      │     │  │
│  │  │ (IPC端点) │──▶│ (业务逻辑)│──▶│ (Shell/File/OS) │     │  │
│  │  └──────────┘  └──────────┘  └────────┬─────────┘     │  │
│  │                                        │               │  │
│  └────────────────────────────────────────┼───────────────┘  │
│                                           │                  │
└───────────────────────────────────────────┼──────────────────┘
                                            │
                    ┌───────────────────────▼───────────────┐
                    │         OpenClaw CLI (Node.js)         │
                    │   npm 全局安装的 openclaw 命令行工具      │
                    │                                        │
                    │  openclaw gateway start/stop/status    │
                    │  openclaw dashboard                    │
                    │  openclaw gateway install              │
                    └────────────────┬──────────────────────┘
                                     │
                    ┌────────────────▼──────────────────────┐
                    │       OpenClaw Gateway (Node.js)       │
                    │       AI 模型代理网关服务                │
                    │                                        │
                    │  HTTP API → 多模型路由 → LLM Provider   │
                    │  实例管理 / Token 计量 / 插件系统        │
                    └───────────────────────────────────────┘
```

---

## 2. 技术栈

### 2.1 前端

| 层级 | 技术 | 版本 | 职责 |
|------|------|------|------|
| 框架 | React | 18.x | UI 渲染 |
| 路由 | React Router | 6.x | 页面导航 |
| 构建 | Vite | 5.x | 开发服务器 & 打包 |
| 语言 | TypeScript | 5.x | 类型安全 |
| 样式 | Inline Styles | - | 当前方案（建议迁移 Tailwind） |
| 测试 | Vitest + Playwright | - | 单元测试 + E2E |

### 2.2 桌面壳

| 层级 | 技术 | 版本 | 职责 |
|------|------|------|------|
| 桌面框架 | Tauri | 2.x | 窗口管理、系统集成、IPC |
| 语言 | Rust | stable | 后端命令、进程管理 |
| 异步运行时 | Tokio | 1.x | 异步子进程执行 |
| HTTP 客户端 | reqwest | latest | Dashboard 探针请求 |

### 2.3 网关层

| 层级 | 技术 | 职责 |
|------|------|------|
| CLI 工具 | openclaw (Node.js) | 通过 npm 全局安装的命令行 |
| 网关服务 | openclaw gateway | 持久化后台 Node.js 服务 |
| 接口 | REST API | 提供模型代理、实例管理 |

---

## 3. 模块架构

### 3.1 前端模块结构

```
src/
├── main.tsx                    # 应用入口
├── router.tsx                  # 路由定义
│
├── pages/                      # 页面组件（一级路由）
│   ├── HomeEntryPage.tsx        # 首页
│   ├── ServicePage.tsx          # Gateway 服务管理
│   ├── DashboardPage.tsx        # 内嵌 Dashboard
│   ├── InstallPage.tsx          # 安装向导
│   ├── ConfigPage.tsx           # 配置管理
│   ├── LogsPage.tsx             # 日志查看
│   ├── OverviewPage.tsx         # 总览
│   ├── RunbookPage.tsx          # 运维手册
│   └── SettingsPage.tsx         # 系统设置
│
├── components/                  # UI 组件
│   ├── common/                  # 通用组件（Modal, Badge, Card...）
│   ├── layout/                  # 布局（AppShell, Sidebar...）
│   ├── service/                 # 服务管理组件
│   ├── install/                 # 安装流程组件
│   ├── dashboard/               # Dashboard 组件
│   ├── config/                  # 配置表单组件
│   ├── logs/                    # 日志组件
│   └── navigation/              # 导航组件
│
├── hooks/                       # 自定义 Hooks
│   ├── useGatewayControl.ts     # ★ Gateway 状态轮询 & 操作
│   ├── useInstallFlow.ts        # 安装流程状态机
│   ├── useLogs.ts               # 日志读取 & 过滤
│   ├── useRunbook.ts            # Runbook 数据加载
│   ├── useEnvironmentSnapshot.ts # 环境检测快照
│   ├── useAppSettingsSnapshot.ts # 设置快照
│   └── useConfigForm.ts         # 配置表单状态
│
├── services/                    # 服务层（IPC 调用封装）
│   ├── tauriClient.ts           # Tauri IPC 桥接
│   ├── serviceService.ts        # Gateway 状态/操作
│   ├── installService.ts        # 安装服务
│   ├── settingsService.ts       # 设置读写
│   ├── configService.ts         # OpenClaw 配置
│   ├── statusService.ts         # 总览状态
│   └── runbookService.ts        # Runbook 数据
│
├── types/                       # TypeScript 类型定义
└── utils/                       # 工具函数
```

### 3.2 Rust 后端模块结构

```
src-tauri/src/
├── main.rs                      # Tauri 应用入口 & 命令注册
│
├── commands/                    # IPC 命令端点（#[tauri::command]）
│   ├── gateway.rs               # get/start/stop/restart_gateway
│   ├── install.rs               # install_openclaw
│   ├── config.rs                # read/write/backup_config
│   ├── connectivity.rs          # test_connection
│   ├── env.rs                   # detect_env
│   ├── logs.rs                  # read_logs, export_diagnostics
│   ├── settings.rs              # read/write_app_settings
│   ├── overview.rs              # get_overview_status
│   └── runbook.rs               # get_runbook_model
│
├── services/                    # 业务逻辑层
│   ├── gateway_service.rs       # ★ Gateway 进程管理核心
│   ├── install_service.rs       # npm install 流程
│   ├── env_service.rs           # 环境检测 & openclaw 路径解析
│   ├── config_service.rs        # 配置文件读写
│   ├── log_service.rs           # 日志文件管理
│   ├── settings_service.rs      # 应用设置持久化
│   ├── overview_service.rs      # 总览状态聚合
│   └── runbook_service.rs       # 运维手册生成
│
├── adapters/                    # 外部系统适配器
│   ├── shell.rs                 # ★ 子进程执行（run_command）
│   ├── openclaw.rs              # openclaw 二进制路径解析
│   ├── platform.rs              # 平台差异抽象
│   └── file_ops.rs              # 文件操作
│
└── models/                      # 数据模型
    ├── error.rs                 # 错误码 & AppError
    └── result.rs                # 统一 Result 类型
```

---

## 4. 核心数据流

### 4.1 Gateway 状态轮询（当前有 Bug 的关键路径）

```
┌─────────────┐    setInterval(5s)    ┌──────────────┐
│ ServicePage  │ ◀──────────────────── │ useGateway   │
│  (React)     │                      │  Control     │
└──────┬──────┘                      └──────┬───────┘
       │                                     │
       │ 渲染状态                             │ refreshStatus()
       │                                     ▼
       │                            ┌──────────────────┐
       │                            │ serviceService    │
       │                            │ .getGatewayStatus │
       │                            └────────┬─────────┘
       │                                     │ invoke("get_gateway_status")
       │                                     ▼
       │                            ┌──────────────────┐
       │                            │ Tauri IPC Bridge  │
       │                            └────────┬─────────┘
       │                                     │
       │                                     ▼
       │                            ┌──────────────────┐
       │                            │ gateway_service   │
       │                            │ ::get_gateway_    │
       │                            │   status()        │
       │                            └────────┬─────────┘
       │                                     │ run_command()
       │                                     ▼
       │                            ┌──────────────────┐
       │                            │ shell::run_command│
       │                            │                  │
       │                            │ Command::new(    │
       │                            │  "openclaw.cmd") │
       │                            │ .args(["gateway",│
       │                            │  "status","--json│
       │                            │  "])             │
       │                            └────────┬─────────┘
       │                                     │ spawn
       │                                     ▼
       │                            ┌──────────────────┐
       │                            │ Node.js 子进程    │
       │                            │ openclaw gateway  │
       │                            │ status --json     │
       │                            └──────────────────┘

⚠️ BUG: 竞态条件下 setInterval 不被 clearInterval，
导致每次页面切换泄露一个永久 interval，
每 5 秒不断 spawn 新的 Node.js 子进程。
```

### 4.2 实例创建流程（基于截图推断）

```
  Step 1          Step 2          Step 3          Step 4
  ┌─────┐        ┌─────┐        ┌─────┐        ┌─────┐
  │ 名称 │──下一步──▶│ 身份 │──下一步──▶│ 模型 │──下一步──▶│ 渠道 │──创建──▶ 保存
  └─────┘        └─────┘        └─────┘        └─────┘
  显示名称        System         模型选择        API Key
  (中文)         Prompt         (GPT-5.3等)    接入配置
```

### 4.3 AI 对话数据流

```
用户输入 → Frontend → Tauri IPC → Rust → OpenClaw Gateway HTTP API
                                                    │
                                           ┌────────▼────────┐
                                           │  模型路由引擎     │
                                           │                  │
                                           │ ┌──────────────┐ │
                                           │ │ APIMart 中转  │ │
                                           │ └──────┬───────┘ │
                                           │        ▼         │
                                           │ ┌──────────────┐ │
                                           │ │ OpenAI / 其他 │ │
                                           │ │ LLM Provider  │ │
                                           │ └──────────────┘ │
                                           └──────────────────┘
                                                    │
                                              SSE 流式返回
                                                    │
用户看到 ◀── Frontend 渲染 ◀── Tauri IPC ◀── Rust ◀──┘
```

---

## 5. 进程模型

```
┌───────────────────────────────────────────────────┐
│                  操作系统                           │
│                                                    │
│  ┌──────────────────────┐                         │
│  │  OpenClaw Manager    │  ← Tauri 主进程 (Rust)  │
│  │  (clawdesk.exe)      │                         │
│  │                      │                         │
│  │  ┌────────────────┐  │                         │
│  │  │ WebView2 渲染   │  │  ← 前端 UI 进程        │
│  │  └────────────────┘  │                         │
│  └──────────┬───────────┘                         │
│             │ spawn (短暂)                         │
│             ▼                                      │
│  ┌──────────────────────┐                         │
│  │ openclaw.cmd          │  ← CLI 命令进程         │
│  │ (node.exe 子进程)     │     (status/start/stop) │
│  └──────────────────────┘     每次调用创建-执行-退出 │
│                                                    │
│  ┌──────────────────────┐                         │
│  │ OpenClaw Gateway     │  ← 持久化网关服务        │
│  │ (node.exe 长驻进程)   │     由 gateway start 启动│
│  │ :3000 / :4317        │     独立于 Manager 运行   │
│  └──────────────────────┘                         │
│                                                    │
└───────────────────────────────────────────────────┘
```

**关键生命周期规则：**

| 进程 | 生命周期 | 管理方式 |
|------|----------|----------|
| Tauri 主进程 | 用户打开 → 关闭窗口 | 操作系统 |
| WebView2 | 随 Tauri 主进程 | Tauri 框架 |
| openclaw CLI 命令 | 调用 → 执行完毕 → 退出 | `run_command()` + `kill_on_drop` |
| Gateway 服务 | `gateway start` → `gateway stop` | 独立守护进程 |

---

## 6. IPC 接口清单

| 前端 invoke | Rust Command | 说明 |
|-------------|--------------|------|
| `detect_env` | `commands::env::detect_env` | 环境检测 |
| `install_openclaw` | `commands::install::install_openclaw` | 后台安装 |
| `install_openclaw_in_terminal` | `commands::install::install_openclaw_in_terminal` | 终端安装 |
| `test_connection` | `commands::connectivity::test_connection` | 连通性测试 |
| `read_openclaw_config` | `commands::config::read_openclaw_config` | 读配置 |
| `write_openclaw_config` | `commands::config::write_openclaw_config` | 写配置 |
| `backup_openclaw_config` | `commands::config::backup_openclaw_config` | 备份配置 |
| `get_gateway_status` | `commands::gateway::get_gateway_status` | 网关状态 |
| `start_gateway` | `commands::gateway::start_gateway` | 启动网关 |
| `stop_gateway` | `commands::gateway::stop_gateway` | 停止网关 |
| `restart_gateway` | `commands::gateway::restart_gateway` | 重启网关 |
| `open_dashboard` | `commands::gateway::open_dashboard` | 打开仪表盘 |
| `probe_dashboard_endpoint` | `commands::gateway::probe_dashboard_endpoint` | 探针检测 |
| `read_logs` | `commands::logs::read_logs` | 读日志 |
| `export_diagnostics` | `commands::logs::export_diagnostics` | 导出诊断 |
| `read_app_settings` | `commands::settings::read_app_settings` | 读设置 |
| `write_app_settings` | `commands::settings::write_app_settings` | 写设置 |
| `get_overview_status` | `commands::overview::get_overview_status` | 总览状态 |
| `get_runbook_model` | `commands::runbook::get_runbook_model` | Runbook |

---

## 7. 已知技术债务 & 修复方案

### 7.1 Critical: 进程泄露（已修复）

**位置：** `src/hooks/useGatewayControl.ts:119-124`

**根因：** `useEffect` 中 `initialize()` 是异步函数，`setInterval` 在 `await` 之后执行。当 cleanup 在 `await` 期间运行时，`pollTimer` 仍为 `null`，导致 `clearInterval` 无效。之后 `initialize` 完成并创建的 interval 成为孤儿，永远不被清除。

**修复：**
```typescript
// BEFORE (Bug)
setIsPolling(true);
pollTimer = window.setInterval(() => { ... }, pollMs);

// AFTER (Fixed)
if (!unmountedRef.current) {
  setIsPolling(true);
  pollTimer = window.setInterval(() => { ... }, pollMs);
}
```

### 7.2 High: 样式方案

**现状：** 全量使用 inline styles，无设计系统。
**建议：** 迁移到 Tailwind CSS + 组件库，统一设计 token。

### 7.3 Medium: 状态管理

**现状：** 纯 React Hooks + 本地状态，无全局状态管理。
**建议：** 引入 Zustand 管理全局状态（Gateway 状态、用户设置、API Keys）。

### 7.4 Medium: 错误边界

**现状：** 缺少 React Error Boundary，组件崩溃可能白屏。
**建议：** 在 AppShell 和各页面入口添加 ErrorBoundary。

---

## 8. v2.0 重构架构建议

### 8.1 引入全局状态

```
┌────────────────────────────────────┐
│           Zustand Store            │
│                                    │
│  ┌──────────┐  ┌───────────────┐  │
│  │ gateway   │  │ instances     │  │
│  │  .status  │  │  .list[]      │  │
│  │  .polling │  │  .selected    │  │
│  └──────────┘  └───────────────┘  │
│                                    │
│  ┌──────────┐  ┌───────────────┐  │
│  │ settings  │  │ auth          │  │
│  │  .theme   │  │  .apiKeys[]   │  │
│  │  .locale  │  │  .activeKey   │  │
│  └──────────┘  └───────────────┘  │
└────────────────────────────────────┘
```

### 8.2 轮询改为事件驱动

```
当前:  setInterval → IPC → spawn CLI → parse JSON → setState
建议:  Tauri Event System
       Rust 侧:  单线程轮询 loop → emit("gateway-status-changed", data)
       前端侧:  listen("gateway-status-changed") → setState

优势:  消除前端 interval 竞态、减少 IPC 调用、后端可控频率
```

### 8.3 进程管理增强

```rust
// 建议在 Rust 侧增加进程注册表
struct ProcessRegistry {
    gateway_pid: Option<u32>,
    active_commands: Vec<Child>,
}

// Tauri app exit 时统一清理
app.on_event(|event| {
    if let tauri::RunEvent::Exit = event {
        registry.kill_all();
    }
});
```
