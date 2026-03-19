# ClawDesk v2.0 — 技术架构文档

> 基于 ClawX 模式全面重构，对齐 OpenClaw Gateway 原生能力。
> 日期：2026-03-19

---

## 1. 架构总览

ClawDesk v2.0 采用三层架构：React 前端通过 Tauri IPC 与 Rust 后端通信，Rust 后端负责进程管理与系统集成，OpenClaw Gateway 作为独立 Node.js 守护进程提供 AI 对话、Agent 编排、Channel 路由等核心能力。

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (React 18)                    │
│  Pages: Chat | Agents | Channels | Providers | Models    │
│         Skills | Cron | Settings | Setup | Feedback      │
│  Stores: Zustand (agents, channels, chat, gateway, etc) │
│  UI: Tailwind CSS v4 + Radix/shadcn primitives          │
│  i18n: react-i18next (zh/en/ja)                         │
├─────────────────────────────────────────────────────────┤
│                   Tauri IPC Bridge                        │
├─────────────────────────────────────────────────────────┤
│                  Rust Backend (Tauri 2)                   │
│  Commands: gateway, agents, channels, providers, cron    │
│  Services: gateway_service, agent_service, channel_svc   │
│  Adapters: shell, openclaw CLI, platform, file_ops       │
├─────────────────────────────────────────────────────────┤
│              OpenClaw Gateway (Node.js daemon)            │
│  REST API + WebSocket                                    │
│  Chat sessions, Agent orchestration, Channel routing     │
└─────────────────────────────────────────────────────────┘
```

**设计原则：**

1. **Gateway 原生优先** — 所有 AI 能力（对话、Agent、Channel、Provider、Model）直接调用 Gateway REST/SSE 接口，前端不再经过 Rust 中转
2. **Tauri IPC 仅做系统集成** — 进程管理、文件操作、环境检测、设置持久化等操作系统级功能走 Rust 命令
3. **Zustand 集中状态** — 所有页面共享的状态通过 Zustand Store 管理，消除 prop drilling 和重复轮询
4. **ClawX 概念对齐** — Agent（原 Instance）、Channel、Provider、Model 等概念完全对齐 OpenClaw Gateway 数据模型

---

## 2. 技术栈

### 2.1 前端技术栈

| 层级 | 技术 | 版本 | 职责 |
|------|------|------|------|
| 框架 | React | 18.x | UI 渲染、组件化 |
| 路由 | React Router DOM | 6.x | SPA 页面导航、嵌套路由 |
| 构建 | Vite | 5.x | 开发服务器、HMR、生产打包 |
| 语言 | TypeScript | 5.x | 类型安全、接口定义 |
| 状态管理 | Zustand | 4.x | 全局状态、跨组件共享 |
| 样式 | Tailwind CSS v4 | 4.x | 原子化 CSS（@tailwindcss/vite 插件） |
| UI 原语 | Radix UI / shadcn | - | 无障碍对话框、下拉、Switch 等 |
| 图标 | Lucide React | - | 统一 SVG 图标集 |
| Markdown | react-markdown + remark-gfm | - | 聊天消息渲染 |
| 国际化 | react-i18next | - | 中文 / 英文 / 日文三语支持 |
| 动画 | Framer Motion | - | 页面过渡、微交互（可选） |

### 2.2 桌面壳（Tauri 2.x）

| 层级 | 技术 | 版本 | 职责 |
|------|------|------|------|
| 桌面框架 | Tauri | 2.x | 窗口管理、系统托盘、IPC 桥接 |
| 语言 | Rust | stable | 后端命令、进程管理、文件 I/O |
| 异步运行时 | Tokio | 1.x | 异步子进程、并发任务 |
| HTTP 客户端 | reqwest | latest | Gateway 健康检查探针 |
| 序列化 | serde / serde_json | latest | IPC 数据序列化 |

### 2.3 Gateway 层

| 层级 | 技术 | 职责 |
|------|------|------|
| CLI 工具 | openclaw（Node.js） | npm 全局安装的命令行管理工具 |
| 网关服务 | OpenClaw Gateway | 持久化 Node.js 守护进程 |
| HTTP 接口 | REST API | Agent CRUD、会话管理、Provider 配置 |
| 流式接口 | Server-Sent Events（SSE） | 聊天流式响应 |
| 实时接口 | WebSocket | Channel 实时状态推送（未来） |

---

## 3. 前端模块结构

### 3.1 目录总览

```
src/
├── main.tsx                    # 应用入口，挂载 React Router + i18n
├── router.tsx                  # 路由表定义
│
├── pages/                      # 页面组件（一级路由）
│   ├── ChatPage.tsx            # AI 对话主界面
│   ├── AgentsPage.tsx          # Agent 管理（原 InstancesPage）
│   ├── ChannelsPage.tsx        # Channel 管理（NEW）
│   ├── ProvidersPage.tsx       # Provider 管理（NEW）
│   ├── ModelsPage.tsx          # 模型管理（原 TokenPage）
│   ├── SkillsPage.tsx          # 技能市场
│   ├── CronPage.tsx            # 定时任务管理（NEW）
│   ├── SettingsPage.tsx        # 系统设置（主题/语言/路径）
│   ├── SetupPage.tsx           # 首次安装引导（NEW）
│   └── FeedbackPage.tsx        # 用户反馈
│
├── components/                 # UI 组件
│   ├── layout/                 # 布局框架
│   │   ├── AppShell.tsx        #   主布局容器（侧边栏 + 内容区）
│   │   ├── Sidebar.tsx         #   侧边栏导航
│   │   └── TitleBar.tsx        #   自定义标题栏
│   ├── ui/                     # 基础 UI 组件（shadcn 风格）
│   │   ├── Button.tsx          #   按钮（primary/secondary/ghost/danger）
│   │   ├── Badge.tsx           #   状态徽章
│   │   ├── Card.tsx            #   卡片容器
│   │   ├── Input.tsx           #   输入框
│   │   ├── Switch.tsx          #   开关
│   │   ├── Select.tsx          #   下拉选择
│   │   ├── Dialog.tsx          #   模态对话框（Radix）
│   │   ├── Tabs.tsx            #   标签页
│   │   └── Tooltip.tsx         #   提示信息
│   ├── agents/                 # Agent 相关组件
│   │   ├── AgentCard.tsx       #   Agent 卡片（状态、操作）
│   │   └── CreateAgentWizard.tsx  # 创建 Agent 向导
│   ├── channels/               # Channel 相关组件
│   │   ├── ChannelCard.tsx     #   Channel 卡片
│   │   └── AddChannelDialog.tsx   # 添加 Channel 对话框
│   ├── providers/              # Provider 相关组件
│   │   ├── ProviderCard.tsx    #   Provider 卡片
│   │   └── AddProviderDialog.tsx  # 添加 Provider 对话框
│   ├── chat/                   # 聊天相关组件
│   │   ├── MessageBubble.tsx   #   消息气泡（支持 Markdown）
│   │   ├── ChatInput.tsx       #   聊天输入框
│   │   └── ToolIndicator.tsx   #   工具调用指示器
│   └── common/                 # 通用组件
│       ├── ErrorBoundary.tsx   #   错误边界
│       ├── LoadingSpinner.tsx  #   加载指示器
│       └── StatusBadge.tsx     #   通用状态徽章
│
├── store/                      # Zustand 状态管理
│   ├── useAgentStore.ts        # Agent 列表 & 选中状态
│   ├── useChatStore.ts         # 聊天会话 & 消息流
│   ├── useGatewayStore.ts      # Gateway 连接状态 & 健康检查
│   ├── useChannelStore.ts      # Channel 列表 & CRUD 操作
│   ├── useProviderStore.ts     # Provider 列表 & 配置
│   ├── useCronStore.ts         # 定时任务列表 & 执行记录
│   ├── useSkillStore.ts        # 技能市场 & 已安装技能
│   └── useSettingsStore.ts     # 应用设置（主题/语言/路径）
│
├── lib/                        # 工具库
│   ├── gateway-client.ts       # Gateway HTTP 客户端（超时/缓存/重试）
│   ├── utils.ts                # 通用工具函数
│   └── constants.ts            # 全局常量定义
│
├── i18n/                       # 国际化资源
│   ├── index.ts                # i18next 初始化配置
│   └── locales/
│       ├── zh/                 #   简体中文
│       ├── en/                 #   英文
│       └── ja/                 #   日文
│
├── types/                      # TypeScript 类型定义
│   ├── agent.ts                # Agent 相关类型
│   ├── channel.ts              # Channel 相关类型
│   ├── provider.ts             # Provider 相关类型
│   ├── cron.ts                 # 定时任务类型
│   └── gateway.ts              # Gateway 状态与配置类型
│
└── styles/
    └── globals.css             # Tailwind 入口 + CSS 变量（主题 token）
```

### 3.2 路由定义

```
/                   → 重定向到 /chat
/chat               → ChatPage           # 对话主界面
/chat/:sessionId    → ChatPage           # 指定会话
/agents             → AgentsPage         # Agent 管理
/channels           → ChannelsPage       # Channel 管理
/providers          → ProvidersPage      # Provider 管理
/models             → ModelsPage         # 模型管理
/skills             → SkillsPage         # 技能市场
/cron               → CronPage           # 定时任务
/settings           → SettingsPage       # 系统设置
/setup              → SetupPage          # 安装引导
/feedback           → FeedbackPage       # 用户反馈
```

### 3.3 Zustand Store 设计

各 Store 遵循统一模式：状态 + 操作 + 异步副作用封装。

```
useGatewayStore
├── state
│   ├── status: "running" | "stopped" | "starting" | "error"
│   ├── version: string | null
│   ├── port: number
│   ├── uptime: number | null
│   └── lastChecked: Date | null
├── actions
│   ├── start()          → Tauri IPC → openclaw gateway start
│   ├── stop()           → Tauri IPC → openclaw gateway stop
│   ├── restart()        → stop() + start()
│   └── refreshStatus()  → Tauri IPC → openclaw gateway status
└── subscriptions
    └── startPolling(interval: 5000ms)  → 定时刷新状态

useAgentStore
├── state
│   ├── agents: Agent[]
│   ├── selectedAgent: Agent | null
│   └── loading: boolean
├── actions
│   ├── fetchAgents()    → Gateway REST GET /agents
│   ├── createAgent()    → Gateway REST POST /agents
│   ├── updateAgent()    → Gateway REST PUT /agents/:id
│   ├── deleteAgent()    → Gateway REST DELETE /agents/:id
│   └── selectAgent(id)
└── derived
    └── activeAgents     → agents.filter(a => a.enabled)

useChatStore
├── state
│   ├── sessions: Session[]
│   ├── activeSessionId: string | null
│   ├── messages: Message[]
│   └── streaming: boolean
├── actions
│   ├── fetchSessions()  → Gateway REST GET /sessions
│   ├── createSession()  → Gateway REST POST /sessions
│   ├── sendMessage()    → Gateway REST POST + SSE 流接收
│   └── deleteSession()  → Gateway REST DELETE /sessions/:id
└── streaming
    └── handleSSE(reader) → 逐 chunk 追加到 messages

useChannelStore
├── state
│   ├── channels: Channel[]
│   └── loading: boolean
├── actions
│   ├── fetchChannels()  → Gateway REST GET /channels
│   ├── addChannel()     → Gateway REST POST /channels
│   ├── removeChannel()  → Gateway REST DELETE /channels/:id
│   └── updateChannel()  → Gateway REST PUT /channels/:id

useProviderStore
├── state
│   ├── providers: Provider[]
│   └── loading: boolean
├── actions
│   ├── fetchProviders() → Gateway REST GET /providers
│   ├── addProvider()    → Gateway REST POST /providers
│   ├── removeProvider() → Gateway REST DELETE /providers/:id
│   └── testProvider()   → Gateway REST POST /providers/:id/test

useSettingsStore
├── state
│   ├── theme: "light" | "dark" | "system"
│   ├── locale: "zh" | "en" | "ja"
│   ├── gatewayPort: number
│   └── openclawPath: string
├── actions
│   ├── load()           → Tauri IPC → read_app_settings
│   ├── save()           → Tauri IPC → write_app_settings
│   ├── setTheme()       → 更新 CSS class + 持久化
│   └── setLocale()      → 切换 i18n 语言 + 持久化
```

---

## 4. Rust 后端模块结构

### 4.1 目录总览

```
src-tauri/src/
├── main.rs                      # Tauri 应用入口 & 命令注册
├── lib.rs                       # 模块声明
│
├── commands/                    # IPC 命令端点 (#[tauri::command])
│   ├── mod.rs                   # 命令模块导出
│   ├── gateway.rs               # Gateway 生命周期管理
│   ├── agent.rs                 # Agent CRUD 代理（原 instance.rs）
│   ├── channel.rs               # Channel 管理代理（NEW）
│   ├── provider.rs              # Provider 管理代理（NEW）
│   ├── cron.rs                  # 定时任务管理代理（NEW）
│   ├── env.rs                   # 环境检测
│   ├── settings.rs              # 应用设置读写
│   └── install.rs               # OpenClaw CLI 安装
│
├── services/                    # 业务逻辑层
│   ├── mod.rs                   # 服务模块导出
│   ├── gateway_service.rs       # Gateway 进程管理核心
│   ├── agent_service.rs         # Agent 操作逻辑（原 instance_service.rs）
│   ├── channel_service.rs       # Channel 操作逻辑（NEW）
│   ├── provider_service.rs      # Provider 操作逻辑（NEW）
│   ├── cron_service.rs          # 定时任务操作逻辑（NEW）
│   ├── env_service.rs           # 环境检测 & 路径解析
│   └── settings_service.rs      # 设置文件持久化
│
├── adapters/                    # 外部系统适配器
│   ├── shell.rs                 # 子进程执行（run_command, kill_on_drop）
│   ├── openclaw.rs              # openclaw 二进制路径解析 & 命令封装
│   └── platform.rs              # 平台差异抽象（Windows/macOS/Linux）
│
└── models/                      # 数据模型
    ├── error.rs                 # 统一错误类型 AppError
    └── result.rs                # 统一 Result<T, AppError>
```

### 4.2 命令层设计

所有 `#[tauri::command]` 函数遵循统一签名约定：

```rust
#[tauri::command]
async fn command_name(
    app: tauri::AppHandle,
    // 可选参数...
) -> Result<ResponseType, String> {
    // 1. 参数校验
    // 2. 调用 service 层
    // 3. 返回序列化结果
}
```

**命令到服务映射表：**

| 命令模块 | 命令函数 | 对应服务 | 说明 |
|----------|----------|----------|------|
| gateway.rs | `get_gateway_status` | gateway_service | 查询 Gateway 运行状态 |
| gateway.rs | `start_gateway` | gateway_service | 启动 Gateway 守护进程 |
| gateway.rs | `stop_gateway` | gateway_service | 停止 Gateway 守护进程 |
| gateway.rs | `restart_gateway` | gateway_service | 重启 Gateway |
| agent.rs | `list_agents` | agent_service | 获取 Agent 列表 |
| agent.rs | `create_agent` | agent_service | 创建 Agent |
| agent.rs | `update_agent` | agent_service | 更新 Agent 配置 |
| agent.rs | `delete_agent` | agent_service | 删除 Agent |
| channel.rs | `list_channels` | channel_service | 获取 Channel 列表 |
| channel.rs | `add_channel` | channel_service | 添加 Channel |
| channel.rs | `remove_channel` | channel_service | 移除 Channel |
| provider.rs | `list_providers` | provider_service | 获取 Provider 列表 |
| provider.rs | `add_provider` | provider_service | 添加 Provider |
| provider.rs | `test_provider` | provider_service | 测试 Provider 连通性 |
| cron.rs | `list_cron_jobs` | cron_service | 获取定时任务列表 |
| cron.rs | `create_cron_job` | cron_service | 创建定时任务 |
| cron.rs | `toggle_cron_job` | cron_service | 启用/禁用定时任务 |
| env.rs | `detect_env` | env_service | 检测 Node.js / npm / openclaw |
| settings.rs | `read_app_settings` | settings_service | 读取应用设置 |
| settings.rs | `write_app_settings` | settings_service | 写入应用设置 |
| install.rs | `install_openclaw` | env_service | 后台安装 openclaw CLI |

---

## 5. 通信模式

ClawDesk v2.0 使用四种通信模式，各有明确的职责边界：

```
┌────────────────────────────────────────────────────────────────┐
│                      通信模式总览                                │
│                                                                │
│  ┌──────────┐   Tauri IPC    ┌──────────┐                     │
│  │ Frontend │ ◀────────────▶ │   Rust   │                     │
│  │ (React)  │   invoke()     │ Backend  │                     │
│  └────┬─────┘                └────┬─────┘                     │
│       │                           │                            │
│       │  HTTP REST                │  spawn/kill                │
│       │  (fetch)                  │  (shell.rs)                │
│       ▼                           ▼                            │
│  ┌─────────────────────────────────────┐                      │
│  │        OpenClaw Gateway             │                      │
│  │        (Node.js daemon)             │                      │
│  │                                     │                      │
│  │  REST API ← Agent/Channel/Provider  │                      │
│  │  SSE     ← 流式聊天响应              │                      │
│  │  WS      ← Channel 实时状态（未来）   │                      │
│  └─────────────────────────────────────┘                      │
└────────────────────────────────────────────────────────────────┘
```

### 5.1 通信模式详解

| 模式 | 用途 | 方向 | 实现 |
|------|------|------|------|
| Tauri IPC | Gateway 生命周期、环境检测、设置读写 | Frontend <-> Rust | `@tauri-apps/api` invoke() |
| Gateway HTTP REST | Agent/Channel/Provider CRUD、会话管理、技能查询 | Frontend -> Gateway | `gateway-client.ts` (fetch) |
| Gateway SSE | 聊天流式响应 | Gateway -> Frontend | ReadableStream + EventSource |
| Gateway WebSocket | Channel 实时状态推送 | Gateway <-> Frontend | 预留，未来实现 |

### 5.2 Tauri IPC 接口清单

| 前端 invoke 调用 | Rust 命令模块 | 说明 |
|-----------------|--------------|------|
| `detect_env` | commands::env | 检测 Node.js / npm / openclaw 版本与路径 |
| `install_openclaw` | commands::install | 后台静默安装 openclaw CLI |
| `get_gateway_status` | commands::gateway | 获取 Gateway 运行状态（JSON） |
| `start_gateway` | commands::gateway | 启动 Gateway 守护进程 |
| `stop_gateway` | commands::gateway | 停止 Gateway 守护进程 |
| `restart_gateway` | commands::gateway | 重启 Gateway |
| `list_agents` | commands::agent | 获取 Agent 列表 |
| `create_agent` | commands::agent | 创建新 Agent |
| `update_agent` | commands::agent | 更新 Agent 配置 |
| `delete_agent` | commands::agent | 删除 Agent |
| `list_channels` | commands::channel | 获取 Channel 列表 |
| `add_channel` | commands::channel | 添加新 Channel |
| `remove_channel` | commands::channel | 移除 Channel |
| `list_providers` | commands::provider | 获取 Provider 列表 |
| `add_provider` | commands::provider | 添加新 Provider |
| `test_provider` | commands::provider | 测试 Provider 连通性 |
| `list_cron_jobs` | commands::cron | 获取定时任务列表 |
| `create_cron_job` | commands::cron | 创建定时任务 |
| `toggle_cron_job` | commands::cron | 启用/禁用定时任务 |
| `read_app_settings` | commands::settings | 读取应用设置 |
| `write_app_settings` | commands::settings | 写入应用设置 |

### 5.3 Gateway REST API 端点

前端通过 `gateway-client.ts` 直接调用 Gateway HTTP 接口：

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/agents` | 获取 Agent 列表 |
| POST | `/api/agents` | 创建 Agent |
| PUT | `/api/agents/:id` | 更新 Agent |
| DELETE | `/api/agents/:id` | 删除 Agent |
| GET | `/api/channels` | 获取 Channel 列表 |
| POST | `/api/channels` | 添加 Channel |
| DELETE | `/api/channels/:id` | 移除 Channel |
| GET | `/api/providers` | 获取 Provider 列表 |
| POST | `/api/providers` | 添加 Provider |
| POST | `/api/providers/:id/test` | 测试 Provider 连通性 |
| GET | `/api/models` | 获取可用模型列表 |
| GET | `/api/sessions` | 获取会话列表 |
| POST | `/api/sessions` | 创建新会话 |
| DELETE | `/api/sessions/:id` | 删除会话 |
| POST | `/api/chat` | 发送消息（SSE 流式响应） |
| GET | `/api/skills` | 获取可用技能 |
| GET | `/api/cron` | 获取定时任务 |
| POST | `/api/cron` | 创建定时任务 |
| GET | `/api/usage` | 获取使用统计 |

---

## 6. 进程模型

### 6.1 进程拓扑

```
┌───────────────────────────────────────────────────┐
│                  操作系统                           │
│                                                    │
│  ┌──────────────────────┐                         │
│  │  ClawDesk            │  <- Tauri 主进程 (Rust)  │
│  │  (clawdesk.exe)      │                         │
│  │                      │                         │
│  │  ┌────────────────┐  │                         │
│  │  │ WebView2 渲染   │  │  <- 前端 UI 进程        │
│  │  └────────────────┘  │                         │
│  └──────────┬───────────┘                         │
│             │ spawn (短暂)                         │
│             ▼                                      │
│  ┌──────────────────────┐                         │
│  │ openclaw.cmd          │  <- CLI 命令进程         │
│  │ (node.exe 子进程)     │     (status/start/stop) │
│  └──────────────────────┘     每次调用创建-执行-退出 │
│                                                    │
│  ┌──────────────────────┐                         │
│  │ OpenClaw Gateway     │  <- 持久化网关服务        │
│  │ (node.exe 长驻进程)   │     由 gateway start 启动│
│  │ :3000                │     独立于 ClawDesk 运行  │
│  └──────────────────────┘                         │
│                                                    │
└───────────────────────────────────────────────────┘
```

### 6.2 进程生命周期

| 进程 | 启动时机 | 结束时机 | 管理方式 |
|------|----------|----------|----------|
| Tauri 主进程 (clawdesk.exe) | 用户启动应用 | 用户关闭窗口 | 操作系统 |
| WebView2 渲染进程 | 随 Tauri 主进程 | 随 Tauri 主进程 | Tauri 框架自动管理 |
| openclaw CLI 命令 | IPC 调用时 spawn | 命令执行完毕后退出 | `shell.rs` run_command + kill_on_drop |
| Gateway 守护进程 | `openclaw gateway start` | `openclaw gateway stop` 或手动 kill | 独立守护进程，不依赖 ClawDesk |

### 6.3 进程管理策略

```
应用启动流程:
┌────────┐    ┌──────────┐    ┌──────────────┐    ┌───────────┐
│ 启动    │───▶│ 检测环境  │───▶│ Gateway 状态  │───▶│ 进入主界面 │
│ ClawDesk│    │ detect_  │    │ get_gateway_  │    │ ChatPage  │
│         │    │ env()    │    │ status()      │    │           │
└────────┘    └────┬─────┘    └──────┬───────┘    └───────────┘
                   │                  │
                   ▼ 未安装            ▼ 未启动
              ┌──────────┐      ┌──────────────┐
              │ SetupPage│      │ 自动启动       │
              │ 安装引导  │      │ start_gateway │
              └──────────┘      └──────────────┘

应用退出流程:
┌────────┐    ┌──────────────┐    ┌──────────┐
│ 关闭    │───▶│ 清理轮询定时器│───▶│ 退出进程  │
│ 窗口    │    │ clearInterval│    │          │
└────────┘    └──────────────┘    └──────────┘
                                  注意: Gateway 继续运行
                                  不随 ClawDesk 退出而停止
```

---

## 7. Gateway 客户端（gateway-client.ts）

前端通过 `lib/gateway-client.ts` 直接与 Gateway 通信，封装 HTTP 请求、超时、缓存和错误处理。

### 7.1 核心设计

```
gateway-client.ts
├── 配置
│   ├── baseUrl: `http://localhost:${port}`
│   ├── timeout: 10000ms（默认）
│   └── retries: 2（GET 请求自动重试）
│
├── 方法
│   ├── get<T>(path, options?)    → fetch GET + JSON 解析
│   ├── post<T>(path, body?)     → fetch POST + JSON 解析
│   ├── put<T>(path, body?)      → fetch PUT + JSON 解析
│   ├── delete<T>(path)          → fetch DELETE
│   └── stream(path, body?)      → fetch POST + ReadableStream (SSE)
│
├── 中间件
│   ├── 超时控制: AbortController + setTimeout
│   ├── 错误映射: HTTP status → 用户友好错误信息
│   ├── 缓存层:   GET 请求可选 TTL 缓存
│   └── 日志:     开发环境下打印请求/响应日志
│
└── SSE 流式处理
    ├── ReadableStream.getReader()
    ├── TextDecoder 逐 chunk 解码
    ├── data: 前缀解析
    └── onChunk / onDone / onError 回调
```

### 7.2 SSE 流式聊天实现

```
用户发送消息
       │
       ▼
useChatStore.sendMessage(content)
       │
       ▼
gateway-client.stream("/api/chat", {
    sessionId, agentId, content
})
       │
       ▼
fetch(url, { method: "POST", body })
       │
       ▼ Response.body (ReadableStream)
       │
  ┌────▼─────────────────────────────┐
  │ while (true) {                    │
  │   const { done, value } = await   │
  │     reader.read();                │
  │   if (done) break;               │
  │   const text = decoder.decode(    │
  │     value);                       │
  │   // 解析 SSE data: 行            │
  │   // 追加到 messages state        │
  │ }                                 │
  └───────────────────────────────────┘
       │
       ▼
  UI 实时更新: MessageBubble 逐字显示
```

---

## 8. 深色/浅色主题架构

### 8.1 主题切换机制

```
┌──────────────────────────────────────────────────────────┐
│                    主题架构                                │
│                                                          │
│  useSettingsStore                                        │
│  ├── theme: "light" | "dark" | "system"                  │
│  └── setTheme(value) ─────┐                              │
│                            │                              │
│                            ▼                              │
│  ┌───────────────────────────────────────┐               │
│  │ 主题应用逻辑                            │               │
│  │                                       │               │
│  │ if (theme === "system") {             │               │
│  │   matchMedia("(prefers-color-scheme:  │               │
│  │     dark)").matches ? "dark" : "light"│               │
│  │ }                                     │               │
│  │                                       │               │
│  │ document.documentElement              │               │
│  │   .classList.toggle("dark", isDark)   │               │
│  └───────────────────────────────────────┘               │
│                            │                              │
│                            ▼                              │
│  ┌───────────────────────────────────────┐               │
│  │ CSS 变量层                              │               │
│  │                                       │               │
│  │ :root {                               │               │
│  │   --background: 0 0% 100%;            │  <- 浅色主题   │
│  │   --foreground: 222 47% 11%;          │               │
│  │   --primary: 222 47% 31%;             │               │
│  │   --muted: 210 40% 96%;              │               │
│  │   --border: 214 32% 91%;             │               │
│  │ }                                     │               │
│  │                                       │               │
│  │ .dark {                               │               │
│  │   --background: 222 47% 11%;          │  <- 深色主题   │
│  │   --foreground: 210 40% 98%;          │               │
│  │   --primary: 217 91% 60%;            │               │
│  │   --muted: 217 33% 17%;             │               │
│  │   --border: 217 33% 17%;            │               │
│  │ }                                     │               │
│  └───────────────────────────────────────┘               │
│                            │                              │
│                            ▼                              │
│  组件使用语义化 token:                                      │
│  bg-background  text-foreground  border-border            │
│  bg-primary     text-primary-foreground                   │
│  bg-muted       text-muted-foreground                    │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### 8.2 语义化 Token 映射

| 语义 Token | 浅色模式 | 深色模式 | 用途 |
|------------|----------|----------|------|
| `--background` | #FFFFFF | #0F172A | 页面背景 |
| `--foreground` | #0F172A | #F8FAFC | 主文字 |
| `--card` | #FFFFFF | #1E293B | 卡片背景 |
| `--primary` | #3B5998 | #3B82F6 | 主操作按钮 |
| `--secondary` | #F1F5F9 | #334155 | 次要按钮 |
| `--muted` | #F1F5F9 | #1E293B | 禁用/次要文字背景 |
| `--border` | #E2E8F0 | #1E293B | 边框颜色 |
| `--destructive` | #EF4444 | #DC2626 | 危险操作 |
| `--accent` | #F1F5F9 | #1E293B | 悬停高亮 |

---

## 9. 国际化（i18n）架构

### 9.1 语言支持

| 语言代码 | 语言 | 说明 |
|----------|------|------|
| `zh` | 简体中文 | 默认语言 |
| `en` | English | 英文 |
| `ja` | 日本語 | 日文 |

### 9.2 翻译文件结构

```
src/i18n/
├── index.ts              # i18next 初始化
│   ├── fallbackLng: "zh"
│   ├── interpolation: { escapeValue: false }
│   └── resources: { zh, en, ja }
└── locales/
    ├── zh/
    │   ├── common.json   # 通用文案（按钮、标签、状态）
    │   ├── chat.json     # 聊天页面
    │   ├── agents.json   # Agent 管理
    │   ├── channels.json # Channel 管理
    │   ├── settings.json # 设置页面
    │   └── setup.json    # 安装引导
    ├── en/
    │   └── ...（同上）
    └── ja/
        └── ...（同上）
```

### 9.3 使用方式

```
组件中使用:
const { t } = useTranslation("agents");
<h1>{t("title")}</h1>           → "Agent 管理"
<p>{t("empty_state")}</p>      → "暂无 Agent，点击创建"
<Button>{t("create")}</Button>  → "创建 Agent"
```

---

## 10. 性能优化策略

### 10.1 轮询与刷新

| 功能 | 策略 | 间隔/延迟 | 清理机制 |
|------|------|-----------|----------|
| Gateway 状态 | setInterval 轮询 | 5000ms | useEffect cleanup + unmountedRef |
| 会话列表刷新 | 防抖（debounce） | 1200ms | 取消前一次未完成请求 |
| 聊天历史加载 | 防抖（debounce） | 800ms | AbortController |
| Gateway 通知 | 事件去重 | - | 基于 eventId 去重 |

### 10.2 懒加载策略

```
路由级懒加载:
const SetupPage = lazy(() => import("./pages/SetupPage"));
const CronPage = lazy(() => import("./pages/CronPage"));
const FeedbackPage = lazy(() => import("./pages/FeedbackPage"));
const SkillsPage = lazy(() => import("./pages/SkillsPage"));

核心页面同步加载（首屏优先）:
import ChatPage from "./pages/ChatPage";
import AgentsPage from "./pages/AgentsPage";
import SettingsPage from "./pages/SettingsPage";
```

### 10.3 请求优化

| 策略 | 说明 |
|------|------|
| 请求缓存 | GET 请求可配置 TTL 内存缓存（技能列表、模型列表） |
| 请求合并 | 多个组件同时请求同一端点时合并为单次 fetch |
| 错误重试 | GET 请求失败后自动重试 2 次（指数退避） |
| 超时控制 | 所有请求 10s 超时，流式请求 60s 超时 |
| 取消机制 | 页面切换时通过 AbortController 取消进行中的请求 |

### 10.4 渲染优化

| 策略 | 说明 |
|------|------|
| Zustand selector | 使用细粒度 selector 避免不必要重渲染 |
| React.memo | 列表项组件（AgentCard、ChannelCard）使用 memo |
| 虚拟列表 | 聊天消息超过 500 条时启用虚拟滚动（未来） |
| Suspense | 配合 lazy() 显示骨架屏加载状态 |

---

## 11. 错误处理架构

### 11.1 错误分层

```
┌─────────────────────────────────────────────────────┐
│                    错误处理层级                        │
│                                                     │
│  Layer 1: React ErrorBoundary                       │
│  ├── 位置: AppShell 顶层                              │
│  ├── 捕获: 渲染时未捕获的异常                            │
│  └── 处理: 显示错误回退 UI + 重试按钮                    │
│                                                     │
│  Layer 2: Zustand Store 错误状态                     │
│  ├── 位置: 各 Store 的 error 字段                     │
│  ├── 捕获: 异步操作失败（API 调用、IPC 调用）             │
│  └── 处理: 页面内 toast 提示 + 状态回滚                 │
│                                                     │
│  Layer 3: Gateway Client 错误映射                    │
│  ├── 位置: gateway-client.ts                         │
│  ├── 捕获: HTTP 错误、网络超时、JSON 解析失败            │
│  └── 处理: 统一错误类型 + i18n 错误消息                 │
│                                                     │
│  Layer 4: Rust AppError                              │
│  ├── 位置: models/error.rs                           │
│  ├── 捕获: 进程执行失败、文件 I/O 错误                   │
│  └── 处理: 序列化为 JSON 字符串返回前端                  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 11.2 Rust 错误类型

```rust
// models/error.rs
pub enum AppError {
    // Gateway 相关
    GatewayNotRunning,
    GatewayStartFailed(String),
    GatewayTimeout,

    // 环境相关
    NodeNotFound,
    OpenClawNotInstalled,
    VersionMismatch { expected: String, found: String },

    // 系统相关
    CommandFailed { cmd: String, stderr: String },
    FileNotFound(String),
    PermissionDenied(String),

    // 通用
    SerializationError(String),
    Unknown(String),
}
```

---

## 12. 安全考量

### 12.1 Tauri 权限模型

Tauri 2.x 使用声明式权限系统，所有 IPC 命令必须在 `capabilities` 配置中显式声明：

| 权限类别 | 包含能力 |
|----------|----------|
| `shell:allow-spawn` | 允许执行子进程（openclaw CLI） |
| `fs:allow-read` | 允许读取配置文件、日志文件 |
| `fs:allow-write` | 允许写入设置文件 |
| `http:allow-fetch` | 允许前端直接请求 Gateway HTTP API |
| `window:allow-set-title` | 允许设置窗口标题 |

### 12.2 Gateway 通信安全

| 措施 | 说明 |
|------|------|
| 仅本地监听 | Gateway 默认绑定 `127.0.0.1:3000`，不暴露外网 |
| 无认证（本地） | 本地场景下不需要 API Key 认证 |
| 超时保护 | 所有请求设置超时，防止资源耗尽 |
| 输入校验 | Rust 层和前端层双重参数校验 |

---

## 13. 构建与部署

### 13.1 开发环境

```
# 前端开发服务器（HMR）
npm run dev           → vite dev（端口 1420）

# Tauri 开发模式（前端 + Rust 联合调试）
npm run tauri dev     → cargo build + vite dev + WebView

# 仅构建前端
npm run build         → vite build → dist/
```

### 13.2 生产构建

```
# 完整构建（前端 + Tauri 打包）
npm run tauri build

输出:
├── src-tauri/target/release/
│   └── clawdesk.exe              # Windows 可执行文件
└── src-tauri/target/release/bundle/
    ├── msi/clawdesk_x.x.x.msi   # MSI 安装包
    └── nsis/clawdesk_x.x.x.exe  # NSIS 安装包
```

### 13.3 Vite 配置要点

```
vite.config.ts
├── plugins
│   ├── @tailwindcss/vite        # Tailwind CSS v4 编译
│   └── @vitejs/plugin-react     # React JSX 转换
├── server
│   ├── port: 1420               # 开发服务器端口
│   └── strictPort: true         # 端口占用时报错
├── build
│   ├── target: "esnext"         # 现代浏览器目标
│   └── outDir: "dist"           # 输出目录
└── resolve
    └── alias: { "@": "./src" }  # 路径别名
```

---

## 14. 核心数据流

### 14.1 Agent 创建流程

```
  Step 1          Step 2          Step 3          Step 4
  ┌─────┐        ┌─────┐        ┌─────┐        ┌─────┐
  │ 名称 │──下一步──▶│ 身份 │──下一步──▶│ 模型 │──下一步──▶│ 渠道 │──创建──▶ 保存
  └─────┘        └─────┘        └─────┘        └─────┘
  Agent 名称      System         选择模型        关联 Channel
  描述信息        Prompt         选择 Provider   启用设置

数据流:
CreateAgentWizard → useAgentStore.createAgent(data)
    → gateway-client.post("/api/agents", data)
    → Gateway 创建 Agent → 返回 Agent ID
    → useAgentStore 更新本地列表
    → 跳转 AgentsPage
```

### 14.2 AI 对话数据流

```
用户输入消息
       │
       ▼
useChatStore.sendMessage(content, agentId)
       │
       ▼
gateway-client.stream("/api/chat", {
    sessionId, agentId, content
})
       │
       ▼ HTTP POST
       │
┌──────▼──────────────────────────────┐
│         OpenClaw Gateway             │
│                                      │
│  接收请求 → 查找 Agent 配置            │
│         → 选择 Provider + Model       │
│         → 构建 prompt (system + user) │
│         → 调用 LLM API               │
│         → SSE 流式返回                │
│                                      │
│  ┌────────────────────────┐          │
│  │  Provider 路由          │          │
│  │  OpenAI / Anthropic /  │          │
│  │  Google / Azure / 其他  │          │
│  └────────────────────────┘          │
└──────┬──────────────────────────────┘
       │
       ▼ SSE 流式返回
       │
  ReadableStream → 逐 chunk 解码
       │
       ▼
  useChatStore: messages 状态实时追加
       │
       ▼
  MessageBubble 组件逐字渲染（Markdown）
```

### 14.3 Gateway 状态轮询

```
┌─────────────┐    setInterval(5s)    ┌──────────────────┐
│ 任意页面      │ ◀──────────────────── │ useGatewayStore  │
│ (Sidebar     │                      │ .startPolling()  │
│  状态指示器)  │                      └──────┬───────────┘
└──────────────┘                             │
                                              │ refreshStatus()
                                              ▼
                                     ┌──────────────────┐
                                     │ Tauri IPC         │
                                     │ invoke(           │
                                     │  "get_gateway_    │
                                     │   status")        │
                                     └────────┬─────────┘
                                              │
                                              ▼
                                     ┌──────────────────┐
                                     │ gateway_service   │
                                     │ → shell::run_cmd  │
                                     │ → openclaw gateway│
                                     │   status --json   │
                                     └────────┬─────────┘
                                              │
                                              ▼
                                     ┌──────────────────┐
                                     │ 解析 JSON         │
                                     │ 更新 Store 状态    │
                                     │ UI 自动重渲染      │
                                     └──────────────────┘

防泄露机制:
├── useEffect cleanup 中 clearInterval
├── unmountedRef 防止异步完成后设置已卸载组件的状态
└── 竞态条件保护: 初始化完成前检查 unmounted 标志
```

---

## 15. 未来演进方向

### 15.1 近期优化（v2.1）

| 方向 | 说明 |
|------|------|
| WebSocket 实时通信 | 替代 Gateway 状态轮询，改为 WS 推送 |
| 虚拟滚动 | 聊天消息超过 500 条时启用虚拟列表 |
| 离线缓存 | Agent/Channel 配置本地缓存，Gateway 断连时仍可查看 |
| 快捷键系统 | 全局快捷键支持（新建对话、切换 Agent 等） |

### 15.2 中期规划（v2.x）

| 方向 | 说明 |
|------|------|
| 插件系统 | 支持第三方插件扩展 Agent 能力 |
| 多窗口 | 支持多个对话窗口并行 |
| 导入/导出 | Agent 配置、对话记录的导入导出 |
| 自动更新 | Tauri updater 集成，支持静默更新 |

### 15.3 长期愿景

| 方向 | 说明 |
|------|------|
| 团队协作 | 多用户共享 Agent 与 Channel 配置 |
| 云端同步 | 对话记录与配置跨设备同步 |
| 移动端 | 基于 Tauri Mobile 的 iOS/Android 版本 |
