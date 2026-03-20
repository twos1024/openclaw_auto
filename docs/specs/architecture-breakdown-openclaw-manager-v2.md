# OpenClaw Manager v2.0 — 架构与技术选型精细拆解

> 目标：基于现有 PRD / Tech Architecture / TDD / System SPEC / UI Design / Refactor Plan 与本地代码现状，形成可执行的架构拆解与技术落地边界。  
> 参考项目：ValueCell-ai/ClawX（架构理念对照）

---

## 1. 输入基线

### 1.1 文档基线

- PRD：`docs/specs/prd-openclaw-manager-v2.md`
- 技术架构：`docs/specs/tech-architecture-openclaw-manager-v2.md`
- TDD：`docs/specs/tdd-openclaw-manager-v2.md`
- System SPEC：`docs/specs/system-spec-openclaw-manager-v2.md`
- UI Design：`docs/specs/ui-design-openclaw-manager-v2.md`
- 重构执行计划：`docs/specs/refactor-plan-v2.md`

### 1.2 本地代码基线（2026-03）

- 前端：`src/`（React + Zustand + Vite + Tailwind）
- 桌面后端：`src-tauri/src/`（Tauri 2 + Rust）
- 已落地迁移：`Instance -> Agent` 的前后端兼容层、store 拆分、i18n 骨架、新路由占位

---

## 2. 总体架构拆解

## 2.1 分层与职责

### L1: Presentation + Domain UI（React）

- 页面层负责展示和交互编排，不直接做系统调用。
- 主要目录：
  - `src/pages`: 路由页面
  - `src/components`: 组合组件与基础 UI
  - `src/store`: 领域状态与异步动作

### L2: Host Bridge（Tauri IPC + HTTP Client）

- 前端统一经 `services` 和 `lib` 调后端：
  - IPC：`src/services/tauriClient.ts`
  - Gateway HTTP/SSE：`src/lib/gateway-client.ts`
- 双通道设计：
  - 系统/本地能力 -> IPC
  - Gateway AI 能力 -> HTTP/SSE

### L3: System Integration（Rust + openclaw CLI + Gateway）

- `commands/*`: IPC 命令暴露
- `services/*`: 业务逻辑和系统调用
- `adapters/*`: shell / platform / file_ops 抽象
- `openclaw` CLI 与 Gateway 进程由 Rust 侧托管

---

## 3. 技术选型矩阵（目标态）

| 维度 | 选型 | 当前状态 | 结论 |
|---|---|---|---|
| Desktop Shell | Tauri 2 + Rust | 已稳定使用 | 保持，不切 Electron |
| UI 框架 | React 18 + TS | 已使用 | 可继续，后续评估 React 19 |
| 构建 | Vite 5 | 已使用 | 保持 |
| 状态管理 | Zustand 分域 Store | 已拆分骨架 | 按领域继续补齐副作用层 |
| 样式系统 | Tailwind v4 + 语义 CSS 变量 | 已有变量体系 | 持续去硬编码色值 |
| 组件原语 | 轻量 shadcn/Radix | 仅部分接入 | 按弹窗、tabs、tooltip 逐步收敛 |
| 国际化 | i18next + react-i18next | 骨架已接入 | 下一步全页面替换硬编码文案 |
| 前后端通信 | IPC + HTTP/SSE 双通道 | 已具备 | 严格按职责边界执行 |
| 测试 | Vitest + Playwright + cargo test | 已有 | 扩展到新域（channel/provider/cron） |

### 选型说明

- 相比 ClawX 的 Electron 主进程代理模型，本项目继续采用 Tauri 2：内存占用更低、Rust 强系统集成能力更适合 CLI/进程控制。
- 需对齐 ClawX 的是“前端统一调用抽象 + 传输策略统一管理”思想，而不是框架本身。

---

## 4. 代码结构精细边界

## 4.1 前端目录边界

### `src/pages`

- 职责：路由入口、页面级编排。
- 约束：不直接调用 `@tauri-apps/api`，仅调用 store/service。

### `src/components`

- `ui/*`: 纯表现组件（无业务依赖）
- `layout/*`: 壳层布局（Sidebar/AppShell）
- `agents/*` 等领域目录：领域组件

### `src/store`

- 每个 store 只管理一个领域状态，异步操作通过 service/client 触发。
- 当前领域：
  - `useAgentStore`
  - `useGatewayStore`
  - `useChannelStore`
  - `useProviderStore`
  - `useCronStore`
  - `useSkillStore`
  - `useSettingsStore`
  - `useChatStore`

### `src/services` 与 `src/lib`

- `services/tauriClient.ts`: 运行时检测、invoke 封装、统一错误信封
- `lib/gateway-client.ts`: Gateway 地址缓存、HTTP 请求、SSE 建联
- 约束：页面禁止绕过这两层直接访问底层 transport

### `src/types`

- 统一领域模型定义，作为前后端 contract 的 TS 侧镜像。
- 新增域类型：agent/channel/provider/cron/gateway。

## 4.2 Rust 目录边界

### `src-tauri/src/commands`

- 仅做 IPC 入参与返回封装，不放业务逻辑。
- `agent.rs` 为现行 Agent IPC 入口；`instance.rs` 已于 v2.1.0 删除。

### `src-tauri/src/services`

- 业务逻辑、状态转换、shell 调用、解析和错误映射。
- `instance_service.rs` 已于 v2.1.0 完全移除，`agent_service.rs` 为唯一 Agent 域实现。

### `src-tauri/src/adapters`

- 跨平台和系统副作用隔离，避免命令层直接操作 OS 细节。

---

## 5. 领域架构拆解（按 PRD/TDD）

## 5.1 Agent 域

- 已具备：
  - 路由与页面：`/agents`
  - 创建向导：`CreateAgentWizard`
  - IPC 命令：`list/create/update/start/stop/delete_agent`
- 待补齐：
  - 数据模型彻底去 `Instance` 残留（字段命名对齐）
  - 与 provider/channel 的真实关联字段落盘
- v2.1.0 已完成：`instance_service` 复用层已删除，`agent_service` 独立运行

## 5.2 Channel 域

- 已具备：路由和 store 骨架
- 缺失：页面组件、Gateway API 客户端、Rust IPC（若需）、状态轮询策略

## 5.3 Provider 域

- 已具备：路由和 store 骨架
- 缺失：Provider CRUD UI、API Key 校验链路、加密存储与引用管理

## 5.4 Cron 域

- 已具备：路由和 store 骨架
- 缺失：cron 表达式校验、任务执行历史、手动触发命令链路

## 5.5 Chat 域

- 已具备：
  - 会话与消息 store
  - SSE 增量流解析
- 待补齐：
  - tool event 协议标准化
  - session 与 agent/provider/channel 的关联策略

## 5.6 Settings / Setup 域

- 已具备：
  - 主题 light/dark/system
  - 语言切换骨架
  - setupComplete 持久化字段
- 待补齐：
  - Setup Wizard 五步流程与页面状态机
  - 全量 i18n 替换

---

## 6. 与 ClawX 的架构对齐点与差异

## 6.1 应对齐（理念）

1. 单一前端调用入口（host-api/client abstraction）
2. 传输策略由宿主层统一管理（重试、降级、错误映射）
3. 进程隔离 + 前端非阻塞
4. 安全存储敏感信息（API Key）

## 6.2 保持差异（实现）

1. ClawX 是 Electron Main 代理；本项目是 Tauri Rust 命令桥
2. ClawX 可主进程代理 HTTP 避免 CORS；本项目默认本地 Gateway 直连 + IPC 协同
3. 技术栈版本可不同，但通信边界和错误模型需一致

## 6.3 需要补的“对齐项”

- 把 `gateway-client + tauriClient` 抽成统一 transport facade（一个前端入口）
- 定义统一错误码语义层（transport / domain / ui 三层）
- 引入“通信回放基线”测试（借鉴 ClawX comms regression 思路）

---

## 7. 当前差距与技术债

1. 术语债：文档和代码仍有 `Instance/APIMart` 残留（尤其 System SPEC 与 Rust service）。
2. 架构债：`agent_service` 仍是 wrapper，尚未形成独立域服务。
3. 产品债：`channels/providers/cron/setup` 仍是占位页，缺业务闭环。
4. 国际化债：仅骨架与少量 key，页面文案仍大量硬编码中文。
5. 测试债：新增域还没有覆盖 unit/integration/e2e 的完整矩阵。

---

## 8. 执行拆分建议（可直接排期）

## 8.1 Epic A：术语与模型收敛（2-3 天）

- 把 `instance_service` 拆解为 `agent_service` 真正实现
- IPC/TS 类型去 `instance` 命名
- 文档术语统一（Agent/Channel/Provider/Cron）

DoD:
- 代码中不再新增 `Instance` 命名
- `list_agents` 成为主链路，`list_instances` 仅兼容

## 8.2 Epic B：Provider + Channel 闭环（4-6 天）

- Provider CRUD + 校验
- Channel CRUD + 状态轮询 + 绑定 Agent
- 安全存储：`apiKeyRef` + 密文落盘策略

DoD:
- 可从 UI 完成 Provider/Channel 全链路操作
- 失败路径有明确 `error code + suggestion`

## 8.3 Epic C：Cron + Setup + 全量 i18n（4-5 天）

- CronJob 管理与触发
- Setup Wizard 五步流程
- 页面文案全量 key 化（zh/en/ja）

DoD:
- `/cron` 和 `/setup` 可独立完成业务流程
- lint 校验禁止硬编码用户可见文本（新增规则或脚本）

## 8.4 Epic D：通信与质量基线（2-3 天）

- 统一 transport facade
- 通信回放与阈值测试
- 新域测试矩阵补齐

DoD:
- `npm run lint`, `npm run test:unit`, `cargo test`, `npm run test:e2e` 全绿
- 新增通信回归检查脚本可在 CI 跑通

---

## 9. 推荐目标目录（稳定态）

```text
src/
  app/                     # AppRuntime / providers / router bootstrap
  domains/
    agent/
      components/
      store/
      services/
      types/
    channel/
    provider/
    cron/
    chat/
    settings/
  shared/
    components/ui/
    lib/transport/
    lib/errors/
    i18n/
    styles/
src-tauri/src/
  commands/
  services/
    agent/
    channel/
    provider/
    cron/
    gateway/
    settings/
  adapters/
  models/
```

说明：
- 若短期不做大规模目录迁移，可先在现有目录执行“逻辑分层迁移”，后续再做物理迁移。

---

## 10. 结论

当前代码已经完成 v2 架构“骨架化”关键步骤（路由、store、i18n、Agent 兼容层、主题/语言），但离 PRD/TDD/SPEC 目标仍差四个业务域闭环与通信治理收口。  
下一阶段应优先补齐 Provider + Channel，再推进 Cron + Setup，并同步完成术语与契约统一，避免后续返工。

