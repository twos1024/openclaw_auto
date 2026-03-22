# OpenClaw Manager v2.0.0 — 全局重构开发方案

> 基于 ClawX 架构，分 6 个阶段执行，预计工作量 ~120 个文件变更

---

## 阶段总览

```
Phase 0: 基础设施（1天）
    ↓
Phase 1: 核心重命名 + Store 拆分（1天）
    ↓
Phase 2: 暗色模式 + 主题系统（0.5天）
    ↓
Phase 3: 新页面开发（2天）
    ↓
Phase 4: 国际化 + Setup Wizard（1天）
    ↓
Phase 5: Rust 后端扩展 + 集成测试（1天）
    ↓
Phase 6: 打包发布 v2.0.0
```

---

## Phase 0 — 基础设施准备

**目标**: 安装新依赖、配置 i18n 框架、建立类型定义

### 0.1 安装依赖

```bash
npm install react-i18next i18next framer-motion \
  @radix-ui/react-tabs @radix-ui/react-dialog \
  @radix-ui/react-tooltip @radix-ui/react-separator
```

### 0.2 创建类型定义文件

```
src/types/
├── agent.ts       # Agent, AgentStatus, CreateAgentPayload
├── channel.ts     # Channel, ChannelType, ConnectionType, ChannelStatus
├── provider.ts    # Provider, ProviderVendor, CreateProviderPayload
├── cron.ts        # CronJob, CronJobInput
├── gateway.ts     # GatewayStatus, GatewayHealth
└── index.ts       # re-export all
```

### 0.3 初始化 i18n

```
src/i18n/
├── index.ts                    # i18next.init({ ... })
└── locales/
    ├── zh/common.json          # 中文（默认）
    ├── en/common.json          # English
    └── ja/common.json          # 日本語
```

### 0.4 删除 APIMart 引用

全局搜索并替换：
- `apimart` → 删除或替换为 `openclaw`
- `APIMart` → `OpenClaw`
- `api.apimart.io` → 删除（由 Provider 管理）
- `Powered by APIMart` → `Powered by OpenClaw`

**验证**: `grep -ri "apimart" src/ src-tauri/` 输出为空

### 0.5 更新版本号

- `package.json` → `"version": "2.0.0"`
- `src-tauri/Cargo.toml` → `version = "2.0.0"`
- `src-tauri/tauri.conf.json` → `"version": "2.0.0"`
- `src/lib/constants.ts` → `APP_VERSION = "2.0.0"`

### 交付物

- [x] 新依赖安装完成
- [x] `src/types/` 全部类型定义
- [x] `src/i18n/` 框架骨架
- [x] 零 APIMart 引用
- [x] `npx tsc --noEmit` 通过

---

## Phase 1 — 核心重命名 + Store 拆分

**目标**: Instance → Agent 重命名，useAppStore 拆分为 8 个 Store

### 1.1 重命名 — 前端

| 旧文件 | 新文件 |
|--------|--------|
| `src/pages/InstancesPage.tsx` | `src/pages/AgentsPage.tsx` |
| `src/pages/TokenPage.tsx` | `src/pages/ModelsPage.tsx` |
| `src/components/instance/CreateInstanceWizard.tsx` | `src/components/agents/CreateAgentWizard.tsx` |
| `src/store/useAppStore.ts` | 拆分（见 1.2） |

代码内批量替换：
- `Instance` → `Agent`
- `instance` → `agent`
- `InstanceRecord` → `Agent`
- `addInstance` → `addAgent`
- `removeInstance` → `removeAgent`
- `updateInstance` → `updateAgent`

### 1.2 Store 拆分

从 `useAppStore` 提取：

```
useAppStore (删除)
├── adminStatus → useGatewayStore.ts
├── gatewayStatus → useGatewayStore.ts
├── instances → useAgentStore.ts
└── sidebarCollapsed → useSettingsStore.ts
```

新建 Store 文件：

| Store | 来源 |
|-------|------|
| `useAgentStore.ts` | 从 useAppStore 提取 + 扩展 channelIds |
| `useGatewayStore.ts` | 从 useAppStore 提取 gateway + admin |
| `useChannelStore.ts` | 全新 |
| `useProviderStore.ts` | 全新 |
| `useCronStore.ts` | 全新 |
| `useSkillStore.ts` | 从 SkillsPage 内联状态提取 |
| `useSettingsStore.ts` | 全新，含 theme/language/setupComplete，persist 中间件 |
| `useChatStore.ts` | 保留，小改适配 Agent |

### 1.3 重命名 — Rust 后端

| 旧文件 | 新文件 |
|--------|--------|
| `src-tauri/src/commands/instance.rs` | `agent.rs` |
| `src-tauri/src/services/instance_service.rs` | `agent_service.rs` |

- 更新 `mod.rs` 中的 `pub mod` 声明
- 更新 `main.rs` 中的 `generate_handler!` 注册
- Rust 结构体 `Instance` → `Agent`
- IPC 命令 `create_instance` → `create_agent` 等

### 1.4 更新路由

```typescript
// router.tsx
{ path: '/agents',    element: <AgentsPage /> },      // 原 /instances
{ path: '/models',    element: <ModelsPage /> },       // 原 /token
{ path: '/channels',  element: <ChannelsPage /> },     // NEW (占位)
{ path: '/providers', element: <ProvidersPage /> },    // NEW (占位)
{ path: '/cron',      element: <CronPage /> },         // NEW (占位)
{ path: '/setup',     element: <SetupPage /> },        // NEW (占位)
```

### 交付物

- [x] 所有 Instance → Agent 重命名完成
- [x] 8 个 Zustand Store 文件就绪
- [x] Rust 后端重命名 + cargo check 通过
- [x] 路由更新 + 新页面占位
- [x] `npm run build` 通过

---

## Phase 2 — 暗色模式 + 主题系统

**目标**: 完整的 light / dark / system 三档主题

### 2.1 CSS 变量扩展

在 `globals.css` 中补全 `.dark` 选择器下所有变量。确保每个 `:root` 变量在 `.dark` 下都有对应值。

### 2.2 Settings 主题控制

在 `SettingsPage` 添加主题选择器（三档 radio/select）：
- ☀️ 浅色
- 🌙 深色
- 💻 跟随系统

### 2.3 App.tsx 主题同步

```typescript
const theme = useSettingsStore(s => s.theme);
useEffect(() => {
  const root = document.documentElement;
  root.classList.remove('light', 'dark');
  if (theme === 'system') {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    root.classList.add(mq.matches ? 'dark' : 'light');
    const handler = (e: MediaQueryListEvent) => { ... };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  } else {
    root.classList.add(theme);
  }
}, [theme]);
```

### 2.4 组件审计

逐文件检查，替换所有硬编码颜色为 CSS 变量：

```
grep -rn "bg-white\|bg-black\|text-white\|text-black\|#[0-9a-fA-F]" src/
```

每处替换为语义 token：
- `bg-white` → `bg-card` 或 `bg-background`
- `text-black` → `text-foreground`
- `bg-black/5` → `bg-foreground/5`（保留透明度语法）
- 内联 `style={{}}` → Tailwind 工具类 + `dark:` 变体

**2026-03-22 完成：** NoticeBanner、PageHero、HomeEntryPage 的内联样式已全部替换为 Tailwind 类，添加暗色主题支持。HomeEntryPage 中的原生 `<button>` 已改为复用 `Button` 组件。

### 2.5 Sidebar 暗色适配

```tsx
// 亮色: 暖米色   暗色: 深灰
className="bg-[hsl(var(--sidebar))]"
```

### 交付物

- [x] `.dark` 变量完整覆盖
- [x] SettingsPage 主题切换可用
- [x] 全部组件无硬编码颜色（含 ConfigPage / OpenAIConfigForm / OllamaConfigForm — 2026-03-22 修复）
- [x] NoticeBanner / PageHero / HomeEntryPage 内联样式替换为 Tailwind（2026-03-22 完成）
- [ ] 亮/暗截图对比验证

---

## Phase 3 — 新页面开发

**目标**: 完成 Channels、Providers、Cron、Models 四个全新页面

### 3.1 ChannelsPage

- 页面标题 + 支持的渠道类型 Tab 切换
- ChannelCard: 图标 + 名称 + 状态指示灯 + 连接/断开按钮
- AddChannelDialog: 选择类型 → 填写凭证 → 绑定 Agent → 保存
- 状态轮询: gateway RPC `channels.status` 每 5s
- 14 种渠道图标（lucide 或自定义 SVG）

### 3.2 ProvidersPage

- Provider 卡片列表: 厂商 logo + 名称 + API Key 状态 + 模型数
- AddProviderDialog: 选择厂商 → 输入 API Key → 在线校验 → baseUrl → 保存
- 校验动画: 发送测试请求 → 成功/失败反馈
- 支持厂商: OpenAI, Anthropic, DeepSeek, Ollama, Google, Qwen, Zhipu, Moonshot, Groq, Mistral, Custom

### 3.3 CronPage

- CronJob 列表: 名称 + cron 表达式 + 下次执行 + 上次状态 + enable/disable 开关
- CreateCronDialog: 名称 → 选择 Agent → 选择 Channel → cron 表达式 → 消息模板
- 立即触发按钮
- 执行历史（可展开）

### 3.4 ModelsPage (原 TokenPage)

- 重构 StatCard 组件：Provider 维度统计
- 增加按 Provider 分组视图
- 增加按日期聚合的柱状图（可选，需 Recharts）

### 交付物

- [x] ChannelsPage 完整可用
- [x] ProvidersPage 完整可用
- [x] CronPage 完整可用
- [x] ModelsPage 增强完成
- [x] 暗色模式下全部页面外观正常

---

## Phase 4 — 国际化 + Setup Wizard

**目标**: 全部用户可见文本走 i18n；首次启动引导

### 4.1 语言包填充

为 9 个命名空间创建 zh/en/ja 各一套翻译文件。

优先级：
1. `common.json` — 通用按钮、状态、错误
2. `chat.json` — 对话相关
3. `agents.json` — Agent 管理
4. `settings.json` — 设置页
5. 其余按需

### 4.2 组件改造

所有页面逐个替换硬编码中文为 `t('key')`：

```tsx
// Before
<h1 className="page-heading">Agent 管理</h1>

// After
const { t } = useTranslation('agents');
<h1 className="page-heading">{t('title')}</h1>
```

### 4.3 Settings 语言切换

```tsx
<Select value={language} onChange={e => {
  i18n.changeLanguage(e.target.value);
  setLanguage(e.target.value);
}}>
  <option value="zh">中文</option>
  <option value="en">English</option>
  <option value="ja">日本語</option>
</Select>
```

### 4.4 Setup Wizard

5 步全屏引导：

```tsx
function SetupPage() {
  const [step, setStep] = useState(0);
  const { setupComplete, markSetupComplete } = useSettingsStore();

  if (setupComplete) return <Navigate to="/chat" />;

  return (
    <AnimatePresence mode="wait">
      {step === 0 && <WelcomeStep onNext={() => setStep(1)} />}
      {step === 1 && <RuntimeCheckStep onNext={() => setStep(2)} onBack={() => setStep(0)} />}
      {step === 2 && <ProviderSetupStep onNext={() => setStep(3)} onBack={() => setStep(1)} />}
      {step === 3 && <GatewayInstallStep onNext={() => setStep(4)} onBack={() => setStep(2)} />}
      {step === 4 && <CompleteStep onDone={() => { markSetupComplete(); navigate('/chat'); }} />}
    </AnimatePresence>
  );
}
```

### 交付物

- [x] 9 × 3 = 27 个翻译文件（实际 20 × 3 = 60 个，含 ConfigPage 表单字段 — 2026-03-22 补全）
- [x] 全部页面 i18n 改造完成（含 OpenAIConfigForm / OllamaConfigForm — 2026-03-22 修复）
- [x] 语言切换即时生效
- [x] Setup Wizard 5 步流程可用
- [x] 首次启动自动进入 Setup

---

## Phase 5 — Rust 后端扩展 + 集成

**目标**: 新增 Channel/Provider/Cron IPC 命令，集成测试

### 5.1 新增 Rust 命令

每个新领域（channel/provider/cron）需要：
1. `commands/{domain}.rs` — Tauri command handlers
2. `services/{domain}_service.rs` — 业务逻辑（调用 openclaw CLI 或 gateway REST）
3. `mod.rs` 注册
4. `main.rs` generate_handler 注册

### 5.2 Gateway Client（Rust 侧）

部分操作（Channel/Provider/Cron）需要 Rust 调用 Gateway REST API：

```rust
// adapters/gateway_http.rs
pub async fn gateway_get<T: DeserializeOwned>(path: &str) -> Result<T, AppError> {
    let addr = gateway_service::get_address().await?;
    let url = format!("{}{}", addr, path);
    let resp = reqwest::get(&url).await?;
    Ok(resp.json::<T>().await?)
}

pub async fn gateway_post<T: DeserializeOwned>(path: &str, body: &impl Serialize) -> Result<T, AppError> {
    let addr = gateway_service::get_address().await?;
    let client = reqwest::Client::new();
    let resp = client.post(format!("{}{}", addr, path))
        .json(body)
        .send().await?;
    Ok(resp.json::<T>().await?)
}
```

### 5.3 集成验证

```bash
# 前端构建
npx tsc --noEmit && npm run build

# Rust 编译
cd src-tauri && cargo check

# 完整打包
npm run tauri:build
```

### 交付物

- [x] `cargo check` 零错误零警告
- [x] `npx tsc --noEmit` 通过
- [x] `npm run build` 成功
- [ ] NSIS 安装包 ≤ 5 MB（待打包验证）
- [ ] 手动冒烟测试全部页面

---

## Phase 6 — 发布 v2.0.0

### 6.1 发布检查清单

- [ ] 全局搜索 `apimart` → 零结果
- [ ] 全局搜索 `TODO` / `FIXME` → 已清理
- [ ] 暗色模式全部页面截图审查
- [ ] 亮色模式全部页面截图审查
- [ ] 中/英/日三语切换验证
- [ ] Setup Wizard 完整流程验证
- [ ] Agent 创建→启动→对话→停止→删除 流程验证
- [ ] Channel 添加→连接→断开→删除 流程验证
- [ ] Provider 添加→校验→删除 流程验证
- [ ] Cron 创建→启用→触发→禁用→删除 流程验证
- [ ] Settings 保存→刷新 持久化验证

### 6.2 Git Tag + Release

```bash
git add -A
git commit -m "feat: v2.0.0 — full refactoring based on ClawX architecture"
git tag v2.0.0
git push origin main --tags
gh release create v2.0.0 \
  "src-tauri/target/release/bundle/nsis/ClawDesk_2.0.0_x64-setup.exe" \
  "src-tauri/target/release/bundle/msi/ClawDesk_2.0.0_x64_en-US.msi" \
  --title "OpenClaw Manager v2.0.0" \
  --notes-file docs/release-notes-v2.0.0.md
```

---

## 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| Gateway API 不支持 Channel/Provider/Cron | 页面空数据 | Rust 侧 fallback 返回空列表，前端显示「Gateway 未运行」 |
| openclaw CLI 命令不存在 | IPC 返回错误 | 与 v1.0 相同策略：synthesise 默认数据 |
| 暗色模式遗漏硬编码颜色 | 视觉异常 | Phase 2 自动化 grep 审计 |
| i18n 翻译缺失 | 显示原始 key | i18next fallback 到中文 |
| 安装包体积膨胀 | 超出 5 MB 预算 | Tree-shaking + 检查 Radix UI bundle + rollup-plugin-visualizer |

---

## 补充：组件提取 & 构建分析（2026-03-22）

### 组件目录提取

将 ChannelsPage / ProvidersPage / CronPage 中内联的 Dialog 和 Card 组件提取到独立目录，对齐 `src/components/agents/` 模式：

```
src/components/channels/
├── AddChannelDialog.tsx    # Channel 创建对话框
├── ChannelCard.tsx         # Channel 卡片（含状态标签）
└── index.ts

src/components/providers/
├── AddProviderDialog.tsx   # Provider 创建对话框
├── ProviderCard.tsx        # Provider 卡片（含验证/切换）
└── index.ts

src/components/cron/
├── CreateCronDialog.tsx    # Cron 任务创建对话框
├── CronJobCard.tsx         # Cron 任务卡片（含历史展开）
└── index.ts
```

- [x] ChannelsPage 瘦身：401 → 131 行（-67%）
- [x] ProvidersPage 瘦身：324 → 112 行（-65%）
- [x] CronPage 瘦身：421 → 117 行（-72%）

### 构建分析工具

- [x] 安装 `rollup-plugin-visualizer` 并集成到 `vite.config.ts`
- [x] 添加 `npm run analyze` 脚本，产出 `dist/bundle-stats.html`
- [x] 开启 gzip/brotli 体积统计

### 服务层模块提取（2026-03-22）

将大型服务文件中的纯逻辑提取为独立模块，提高可测试性和可读性：

- [x] `configService.ts`（453行→240行）：配置解析逻辑提取到 `configParser.ts`（175行）
- [x] `installService.ts`（470行→90行）：阶段构建提取到 `installPhases.ts`，问题规范化提取到 `installIssues.ts`
- [x] 所有 re-export 保持兼容，现有 import 无需修改
- [x] 97 个测试用例全部通过

### 内联样式清理（2026-03-22）

- [x] `NoticeBanner.tsx`：内联样式 → Tailwind 类 + `dark:` 暗色变体
- [x] `PageHero.tsx`：内联样式 → Tailwind 语义色（`text-foreground`, `text-muted-foreground`）
- [x] `HomeEntryPage.tsx`：17 处内联样式全部替换，原生 `<button>` 改为复用 `Button` 组件

---

## 依赖关系图

```
Phase 0 ──→ Phase 1 ──→ Phase 2
                │              │
                ↓              ↓
            Phase 3 ←── Phase 2
                │
                ↓
            Phase 4
                │
                ↓
            Phase 5 ──→ Phase 6
```

Phase 0/1/2 严格顺序；Phase 3 依赖 Phase 1+2；Phase 4 依赖 Phase 3；Phase 5 与 Phase 4 可部分并行。
