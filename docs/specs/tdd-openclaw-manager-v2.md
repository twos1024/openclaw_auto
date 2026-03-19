# OpenClaw Manager v2.0.0 — 技术设计文档 (TDD)

> 基于 ClawX 项目架构全面重构，去除 APIMart 依赖，对齐 OpenClaw 生态

---

## 1. 设计目标

| 编号 | 目标 | 衡量标准 |
|------|------|---------|
| G1 | 对齐 ClawX 功能集 | Agent / Channel / Provider / Cron / Skills 五大领域覆盖 |
| G2 | 去除 APIMart | 代码中不再出现 `apimart` 字面量，渠道改为 Provider 模型 |
| G3 | 暗色/亮色/跟随系统 | 全部组件使用 CSS 变量，无硬编码颜色 |
| G4 | 国际化 | 中/英/日三语，所有用户可见字符串走 i18n |
| G5 | 首次启动引导 | Setup Wizard（欢迎→运行时→Provider→安装→完成） |
| G6 | 打包体积 ≤ 5 MB | NSIS 安装包 ≤ 5 MB |

---

## 2. 核心领域模型

### 2.1 Agent（原 Instance）

```typescript
interface Agent {
  id: string;                     // "agent-{hex}-{hash}"
  name: string;                   // 显示名称
  systemPrompt: string;           // System Prompt
  modelId: string;                // 如 "gpt-4o", "claude-sonnet-4-6"
  modelName: string;              // 人类可读模型名
  providerId: string;             // 关联的 Provider ID
  channelIds: string[];           // 已分配的 Channel ID 列表
  status: 'created' | 'active' | 'archived';
  temperature: number;
  maxTokens: number;
  createdAt: string;              // ISO 8601
  updatedAt: string;
  lastActiveAt: string | null;
  totalTokensUsed: number;
  totalConversations: number;
}
```

**状态机：**
```
DRAFT → create_agent → CREATED → start_agent → ACTIVE
                                                  ↓ stop_agent
                                                CREATED
                                                  ↓ delete_agent
                                               (removed)
```

### 2.2 Channel

```typescript
type ChannelType =
  | 'whatsapp' | 'telegram' | 'discord' | 'dingtalk'
  | 'feishu' | 'wecom' | 'signal' | 'line'
  | 'msteams' | 'googlechat' | 'mattermost' | 'qqbot'
  | 'imessage' | 'matrix';

type ConnectionType = 'token' | 'qr' | 'oauth' | 'webhook';

interface Channel {
  id: string;
  type: ChannelType;
  name: string;                   // 用户自定义名
  connectionType: ConnectionType;
  credentials: Record<string, string>;  // 加密存储
  status: 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';
  statusDetail: string;
  agentId: string | null;         // 已绑定的 Agent
  createdAt: string;
  updatedAt: string;
}
```

**状态机：**
```
DISCONNECTED → connect → CONNECTING → success → CONNECTED
                              ↓ fail              ↓ disconnect
                            ERROR              DISCONNECTED
                              ↓ retry
                          RECONNECTING → success → CONNECTED
```

### 2.3 Provider

```typescript
type ProviderVendor =
  | 'openai' | 'anthropic' | 'deepseek' | 'ollama'
  | 'google' | 'mistral' | 'groq' | 'qwen'
  | 'zhipu' | 'moonshot' | 'custom';

interface Provider {
  id: string;
  vendor: ProviderVendor;
  name: string;                   // 用户自定义名
  apiKey: string;                 // 运行时传输，不持久化明文
  apiKeyRef: string;              // 加密引用（AES-256-GCM）
  baseUrl: string;
  models: string[];               // 该 Provider 支持的模型列表
  isValid: boolean;               // 最近一次校验结果
  lastValidatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
```

### 2.4 CronJob

```typescript
interface CronJob {
  id: string;
  name: string;
  schedule: string;               // cron 表达式，如 "0 9 * * 1-5"
  agentId: string;                // 执行此任务的 Agent
  channelId: string;              // 发送结果的 Channel
  message: string;                // 发送的消息/指令
  enabled: boolean;
  lastRun: string | null;
  nextRun: string | null;
  lastStatus: 'success' | 'failed' | null;
  createdAt: string;
}
```

### 2.5 ChatSession / ChatMessage

```typescript
interface ChatSession {
  key: string;                    // "agent:{agentId}:{timestamp}"
  label: string;
  agentId: string;
  lastActivity: number;           // Unix timestamp
  messageCount: number;
}

type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string | ContentBlock[];
  timestamp: number;
  agentId?: string;
  attachments?: AttachedFile[];
}

interface ContentBlock {
  type: 'text' | 'thinking' | 'tool_use' | 'tool_result' | 'image';
  text?: string;
  thinking?: string;
  id?: string;
  name?: string;
  input?: unknown;
  data?: string;      // base64
  mimeType?: string;
}
```

---

## 3. Zustand Store 拆分

v1.0 仅 2 个 store（useAppStore + useChatStore），v2.0 拆分为 8 个：

| Store | 职责 | 持久化 |
|-------|------|--------|
| `useAgentStore` | Agent CRUD + 状态 | ✗ |
| `useChatStore` | 消息、会话、流式 | ✗ |
| `useGatewayStore` | Gateway 生命周期、状态轮询 | ✗ |
| `useChannelStore` | Channel 列表、连接状态 | ✗ |
| `useProviderStore` | Provider 配置、校验状态 | ✗ |
| `useCronStore` | CronJob CRUD | ✗ |
| `useSkillStore` | 技能列表、市场搜索 | ✗ |
| `useSettingsStore` | 主题、语言、首次引导标记 | ✓ localStorage |

---

## 4. 通信架构

```
┌──────────────────────┐
│    React Frontend     │
│  (Zustand Stores)     │
├──────────────────────┤
│ ①Tauri IPC  ②HTTP   │  ← 双通道
├──────────────────────┤           ┌──────────────────┐
│  Rust Backend (Tauri) │ ──shell──→│ openclaw CLI     │
│  commands/ services/  │           │  (Node.js)       │
├──────────────────────┤           ├──────────────────┤
                                   │ OpenClaw Gateway  │
②HTTP ─────────────────────────────→│  REST + WebSocket │
                                   │  SSE (streaming)  │
                                   └──────────────────┘
```

**通道选择规则：**

| 操作类型 | 通道 | 原因 |
|---------|------|------|
| Gateway 启停 | Tauri IPC → Rust → shell | 需要进程管理 |
| Agent CRUD | Tauri IPC → Rust → openclaw CLI | 持久化在本地 |
| Channel CRUD | Gateway HTTP REST | Gateway 管理连接 |
| Provider CRUD | Gateway HTTP REST | Gateway 需要 API Key 做校验 |
| Chat 发送/流式 | Gateway HTTP SSE | 避免 IPC 序列化开销 |
| 用量查询 | Gateway HTTP REST | 数据在 Gateway 侧 |
| 技能管理 | Gateway HTTP REST | 技能运行在 Gateway 进程 |
| Cron 管理 | Gateway HTTP REST | 定时器运行在 Gateway |
| 应用设置 | Tauri IPC → Rust | 本地文件 |
| 环境检测 | Tauri IPC → Rust → shell | 需要系统调用 |

---

## 5. 前端页面路由

```typescript
const routes = [
  { path: '/',           redirect: '/chat' },
  { path: '/chat',       element: <ChatPage /> },
  { path: '/agents',     element: <AgentsPage /> },
  { path: '/channels',   element: <ChannelsPage /> },
  { path: '/providers',  element: <ProvidersPage /> },
  { path: '/models',     element: <ModelsPage /> },     // 原 TokenPage
  { path: '/skills',     element: <SkillsPage /> },
  { path: '/cron',       element: <CronPage /> },
  { path: '/settings',   element: <SettingsPage /> },
  { path: '/feedback',   element: <FeedbackPage /> },
  { path: '/setup',      element: <SetupPage /> },       // 首次引导
];
```

**Sidebar 导航项：**

| 图标 | 标签 | 路由 |
|------|------|------|
| MessageSquare | AI 对话 | /chat |
| Bot | Agent 管理 | /agents |
| Radio | 渠道管理 | /channels |
| Key | Provider 管理 | /providers |
| BarChart2 | 用量统计 | /models |
| Zap | 技能管理 | /skills |
| Clock | 定时任务 | /cron |

Footer: 设置 + 反馈 + 版本号

---

## 6. 暗色模式设计方案

### 6.1 CSS 变量体系

所有颜色通过 HSL 三元组变量定义（不含 `hsl()` 包裹，便于 Tailwind 使用透明度修饰符）：

```css
/* 亮色 */
:root {
  --background: 45 36.4% 91.4%;       /* 暖米色 */
  --foreground: 222.2 84% 4.9%;
  --card: 0 0% 100%;
  --primary: 221.2 83.2% 53.3%;       /* 蓝色 */
  --destructive: 0 84.2% 60.2%;
  --border: 214.3 31.8% 91.4%;
  --sidebar: 45 28% 88%;
}

/* 暗色 */
.dark {
  --background: 240 4% 11%;           /* 深灰 */
  --foreground: 210 20% 96%;
  --card: 240 4% 14%;
  --primary: 217.2 91.2% 59.8%;
  --destructive: 0 62.8% 30.6%;
  --border: 217.2 32.6% 17.5%;
  --sidebar: 240 4% 9%;
}
```

### 6.2 主题切换逻辑

```typescript
// useSettingsStore.ts
interface SettingsStore {
  theme: 'light' | 'dark' | 'system';
  setTheme: (theme: Theme) => void;
}

// App.tsx — 同步主题到 DOM
useEffect(() => {
  const root = document.documentElement;
  root.classList.remove('light', 'dark');

  if (theme === 'system') {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    root.classList.add(mq.matches ? 'dark' : 'light');
    const handler = (e: MediaQueryListEvent) => {
      root.classList.remove('light', 'dark');
      root.classList.add(e.matches ? 'dark' : 'light');
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  } else {
    root.classList.add(theme);
  }
}, [theme]);
```

### 6.3 组件规则

- **禁止** 在 className 中使用原始颜色（如 `bg-white`、`text-black`）
- **必须** 使用语义变量（如 `bg-background`、`text-foreground`、`bg-card`）
- 状态色 **必须** 成对出现：`text-green-600 dark:text-green-400`
- Sidebar 使用 `bg-[hsl(var(--sidebar))]` 而非硬编码

---

## 7. 国际化 (i18n) 方案

### 7.1 技术选型

- 框架：`react-i18next`
- 语言包存放：`src/i18n/locales/{lang}/{namespace}.json`
- 命名空间：`common`, `chat`, `agents`, `channels`, `providers`, `skills`, `cron`, `settings`, `setup`

### 7.2 目录结构

```
src/i18n/
├── index.ts              // i18next 初始化
└── locales/
    ├── zh/
    │   ├── common.json
    │   ├── chat.json
    │   ├── agents.json
    │   ├── channels.json
    │   ├── providers.json
    │   ├── skills.json
    │   ├── cron.json
    │   ├── settings.json
    │   └── setup.json
    ├── en/
    │   └── ... (同上)
    └── ja/
        └── ... (同上)
```

### 7.3 使用模式

```tsx
import { useTranslation } from 'react-i18next';

function AgentsPage() {
  const { t } = useTranslation('agents');
  return <h1 className="page-heading">{t('title')}</h1>;
}
```

---

## 8. Setup Wizard 设计

### 8.1 步骤流程

```
Welcome → RuntimeCheck → ProviderSetup → GatewayInstall → Complete
   1            2              3               4            5
```

| 步骤 | 内容 | 校验 |
|------|------|------|
| 1. 欢迎 | Logo + 产品介绍 + 开始按钮 | 无 |
| 2. 运行时检测 | 自动检测 Node.js / npm / openclaw CLI | 全部通过才能继续 |
| 3. Provider 配置 | 选择 AI 厂商 + 输入 API Key + 在线校验 | Key 校验通过 |
| 4. Gateway 安装 | 自动安装 openclaw（如未安装）+ 启动 Gateway | Gateway running |
| 5. 完成 | 恭喜 + 进入主界面 | 标记 setupComplete=true |

### 8.2 技术实现

- 全屏路由 `/setup`，不套 AppShell 布局
- 首次启动检测：`useSettingsStore.setupComplete === false`
- 步骤间动画：Framer Motion `AnimatePresence` + slide
- 完成后标记 `setupComplete = true` 并 navigate('/chat')

---

## 9. Rust 后端变更清单

### 9.1 重命名

| v1.0 | v2.0 | 说明 |
|------|------|------|
| `instance.rs` | `agent.rs` | 命令文件 |
| `instance_service.rs` | `agent_service.rs` | 服务文件 |
| `InstanceRecord` (TS) | `Agent` (TS) | 前端类型 |
| `Instance` (Rust) | `Agent` (Rust) | 后端结构体 |
| `create_instance` | `create_agent` | IPC 命令 |
| `list_instances` | `list_agents` | IPC 命令 |
| `start_instance` | `start_agent` | IPC 命令 |
| `stop_instance` | `stop_agent` | IPC 命令 |
| `delete_instance` | `delete_agent` | IPC 命令 |

### 9.2 新增 IPC 命令

```rust
// channel.rs
pub async fn list_channels() -> CommandResult<Vec<Channel>>
pub async fn add_channel(payload: AddChannelPayload) -> CommandResult<Channel>
pub async fn update_channel(payload: UpdateChannelPayload) -> CommandResult<Channel>
pub async fn delete_channel(id: String) -> CommandResult<DeleteResult>

// provider.rs
pub async fn list_providers() -> CommandResult<Vec<Provider>>
pub async fn create_provider(payload: CreateProviderPayload) -> CommandResult<Provider>
pub async fn update_provider(payload: UpdateProviderPayload) -> CommandResult<Provider>
pub async fn delete_provider(id: String) -> CommandResult<DeleteResult>
pub async fn validate_provider(id: String) -> CommandResult<ValidationResult>

// cron.rs
pub async fn list_cron_jobs() -> CommandResult<Vec<CronJob>>
pub async fn create_cron_job(payload: CreateCronJobPayload) -> CommandResult<CronJob>
pub async fn update_cron_job(payload: UpdateCronJobPayload) -> CommandResult<CronJob>
pub async fn delete_cron_job(id: String) -> CommandResult<DeleteResult>
pub async fn trigger_cron_job(id: String) -> CommandResult<TriggerResult>
```

---

## 10. 文件变更总览

### 10.1 删除

| 文件 | 原因 |
|------|------|
| `src/pages/InstancesPage.tsx` | 重命名为 AgentsPage |
| `src/pages/TokenPage.tsx` | 重命名为 ModelsPage |
| `src/store/useAppStore.ts` | 拆分为多个 store |
| `src/components/instance/` | 重命名为 agents/ |
| `src-tauri/src/commands/instance.rs` | 重命名 |
| `src-tauri/src/services/instance_service.rs` | 重命名 |

### 10.2 新增

| 文件 | 用途 |
|------|------|
| `src/pages/AgentsPage.tsx` | Agent 管理页 |
| `src/pages/ChannelsPage.tsx` | 渠道管理页 |
| `src/pages/ProvidersPage.tsx` | Provider 管理页 |
| `src/pages/ModelsPage.tsx` | 用量统计页（原 Token） |
| `src/pages/CronPage.tsx` | 定时任务页 |
| `src/pages/SetupPage.tsx` | 首次引导页 |
| `src/store/useAgentStore.ts` | Agent 状态 |
| `src/store/useGatewayStore.ts` | Gateway 状态 |
| `src/store/useChannelStore.ts` | Channel 状态 |
| `src/store/useProviderStore.ts` | Provider 状态 |
| `src/store/useCronStore.ts` | Cron 状态 |
| `src/store/useSkillStore.ts` | Skill 状态 |
| `src/store/useSettingsStore.ts` | 设置 + 持久化 |
| `src/components/agents/` | Agent 组件目录 |
| `src/components/channels/` | Channel 组件目录 |
| `src/components/providers/` | Provider 组件目录 |
| `src/components/common/ErrorBoundary.tsx` | 错误边界 |
| `src/components/common/LoadingSpinner.tsx` | 加载动画 |
| `src/components/common/StatusBadge.tsx` | 状态标记 |
| `src/i18n/` | 国际化目录 |
| `src/types/agent.ts` | Agent 类型 |
| `src/types/channel.ts` | Channel 类型 |
| `src/types/provider.ts` | Provider 类型 |
| `src/types/cron.ts` | Cron 类型 |
| `src-tauri/src/commands/agent.rs` | Agent 命令 |
| `src-tauri/src/commands/channel.rs` | Channel 命令 |
| `src-tauri/src/commands/provider.rs` | Provider 命令 |
| `src-tauri/src/commands/cron.rs` | Cron 命令 |
| `src-tauri/src/services/agent_service.rs` | Agent 服务 |
| `src-tauri/src/services/channel_service.rs` | Channel 服务 |
| `src-tauri/src/services/provider_service.rs` | Provider 服务 |
| `src-tauri/src/services/cron_service.rs` | Cron 服务 |

### 10.3 修改

| 文件 | 变更 |
|------|------|
| `src/styles/globals.css` | 完善暗色变量，添加 .dark 选择器 |
| `src/router.tsx` | 新增路由 |
| `src/components/navigation/Sidebar.tsx` | 新增导航项 |
| `src/components/layout/AppShell.tsx` | 主题 class 同步 |
| `src/pages/SettingsPage.tsx` | 主题/语言设置 |
| `src/pages/ChatPage.tsx` | ContentBlock 支持、media 附件 |
| `src/pages/SkillsPage.tsx` | 对接 ClawHub 市场 |
| `src/lib/gateway-client.ts` | 补充 Channel/Provider/Cron API |
| `src/lib/constants.ts` | 版本号 → 2.0.0 |
| `src-tauri/src/main.rs` | 注册新命令 |
| `src-tauri/Cargo.toml` | 版本 → 2.0.0 |
| `src-tauri/tauri.conf.json` | 版本 → 2.0.0 |
| `package.json` | 新依赖 + 版本 → 2.0.0 |

---

## 11. 新增依赖

| 包名 | 用途 | 版本 |
|------|------|------|
| `react-i18next` | 国际化框架 | ^15.x |
| `i18next` | i18n 核心 | ^24.x |
| `framer-motion` | 动画（Setup Wizard） | ^12.x |
| `@radix-ui/react-tabs` | Tabs 组件 | ^1.x |
| `@radix-ui/react-dialog` | 对话框原语 | ^1.x |
| `@radix-ui/react-tooltip` | Tooltip 组件 | ^1.x |
| `@radix-ui/react-separator` | 分隔线 | ^1.x |

---

## 12. 测试策略

| 层级 | 工具 | 覆盖目标 |
|------|------|---------|
| 单元测试 | Vitest | Store 逻辑、utils 函数、类型校验 |
| 组件测试 | Vitest + @testing-library/react | UI 组件渲染、交互 |
| 集成测试 | Playwright | 页面路由、表单提交、主题切换 |
| Rust 测试 | `cargo test` | IPC 命令、服务逻辑 |

---

## 13. 性能预算

| 指标 | 目标 |
|------|------|
| 首屏渲染 (FCP) | < 800ms |
| JS Bundle | < 500 KB gzip |
| CSS Bundle | < 40 KB gzip |
| NSIS 安装包 | ≤ 5 MB |
| Gateway 轮询间隔 | 5s（可配置） |
| Chat SSE 首字节 | < 2s (取决于 LLM) |
| 内存占用（空闲） | < 150 MB |
