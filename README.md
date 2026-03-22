# ClawDesk

ClawDesk 是 OpenClaw 的本地桌面控制台，基于 `Tauri v2 + React + Vite + TypeScript + Rust`。

它不重新实现 OpenClaw，本项目当前聚焦以下能力：

- 安装 OpenClaw CLI
- Install Wizard 与 Setup Assistant 引导式安装流程
- 读写和备份 OpenClaw 配置
- 启动、停止、重启 Gateway
- 打开本地 Dashboard
- 在桌面内嵌 OpenClaw Dashboard，并提供加载失败 / 超时 / iframe 阻断诊断
- 查看安装 / 启动 / Gateway 日志
- 导出诊断摘要和 ZIP 诊断包
- 管理 Agent、Channel、Provider、Cron 等领域实体
- 管理 ClawDesk 自身设置（主题、语言、轮询间隔等）
- 在 Overview 页聚合展示当前健康状态和推荐下一步动作

## 当前页面

- `OverviewPage`: 聚合健康状态、推荐下一步动作、支持直接打开 Dashboard
- `HomeEntryPage`: 首页入口、自动运行 launch check、blocker 引导、深链到具体步骤
- `DashboardPage`: 内嵌 Dashboard、外部打开、页面加载诊断、平台排障提示
- `InstallPage`: 环境检查、安装阶段时间线、安装结果提示、Install Wizard、平台安装指导
- `ConfigPage`: OpenAI-compatible / Ollama 配置、校验、测试连接、自动备份后保存
- `ServicePage`: Gateway 启停、轮询状态、端口冲突提示、打开 Dashboard
- `LogsPage`: 日志查看、关键字过滤、错误摘要、导出文本诊断、导出 ZIP 诊断包
- `SettingsPage`: 诊断目录、日志行数限制、Gateway 轮询间隔、安装源偏好、运行时诊断
- `RunbookPage`: 汇总 launch check、当前 blocker、恢复步骤和工作流上下文
- `AgentsPage`: Agent 列表与创建向导
- `ChannelsPage`: Channel 管理与状态展示
- `ProvidersPage`: Provider 管理与 API Key 校验
- `CronPage`: Cron 定时任务管理

全局对话框：

- `Setup Assistant`: 即时 launch check、引导式下一步动作、可直接深链到 Install Wizard
- `Workspace Runtime Banner`: 全局展示当前运行时模式、桥接状态和阻塞提示

## 目录结构

```text
src/
  components/           # React UI 组件（按功能域分组）
    agents/             # Agent 创建向导
    common/             # 通用组件（ErrorBoundary, LoadingSpinner, NoticeBanner, PageHero 等）
    config/             # 配置表单（OpenAI, Ollama）
    dashboard/          # Dashboard 内嵌与诊断
    dialogs/            # 全局对话框（SetupAssistant）
    install/            # 安装向导与进度
    layout/             # 应用壳层（AppShell, Sidebar, 路由守卫）
    logs/               # 日志查看器与错误摘要
    navigation/         # 导航组件
    overview/           # 概览页组件
    runbook/            # Runbook 组件
    service/            # Gateway 服务控制
    ui/                 # 基础 UI 组件库（基于 Radix）
  hooks/                # 自定义 React Hooks
  i18n/                 # i18next 国际化（中/英/日）
  lib/                  # 工具函数（utils, preferences, constants, gateway-client）
  pages/                # 页面组件（19 个路由）
  services/             # 业务逻辑层
    hostClient.ts       # 宿主桥接规范入口（运行时检测、invoke 封装）
    tauriClient.ts      # 兼容层（re-export shim，将在下个版本移除）
    configService.ts    # 配置读写与连接测试
    configParser.ts     # 配置解析纯函数（从 configService 提取）
    installService.ts   # 安装流程编排
    installPhases.ts    # 安装阶段构建纯函数（从 installService 提取）
    installIssues.ts    # 安装问题规范化纯函数（从 installService 提取）
    ...                 # statusService, serviceService, diagnosticsService 等
  store/                # Zustand 状态管理（7 个领域 Store）
  types/                # TypeScript 类型定义（16 个类型文件）
  utils/                # 校验器、错误映射
  router.tsx            # React Router 路由配置（Hash 模式）
  AppRuntime.tsx        # 应用初始化、主题/语言设置
  main.tsx              # 入口文件
src-tauri/
  src/
    adapters/           # 平台抽象（shell, platform, file_ops）
    commands/           # Tauri IPC 命令处理（20+ 命令）
    models/             # 错误类型、CommandResult 封装
    services/           # 业务逻辑（config, gateway, connectivity 等）
tests/
  unit/                 # Vitest 单元测试
  integration/          # 集成测试（Mock Host Bridge）
  e2e/                  # Playwright 端到端测试
docs/
  specs/                # 产品与技术规格文档
  release-notes/        # 版本发布说明
```

## 本地环境要求

### 通用

- Node.js 20+
- npm
- Rust stable toolchain
- `cargo` 可用

### Windows

- Visual Studio C++ Build Tools
- Windows SDK
- 建议已安装 WiX Toolset（本地构建 MSI 需要）

### macOS

- Xcode Command Line Tools
- Homebrew 安装场景下，ClawDesk 会额外补充 `/opt/homebrew/bin`、`/usr/local/bin` 等常见 PATH 目录

### Linux

- GTK/WebKitGTK 构建依赖
- `libwebkit2gtk-4.1-dev`
- `libayatana-appindicator3-dev`
- `librsvg2-dev`
- `libxdo-dev`
- `libssl-dev`
- `patchelf`
- ClawDesk 在 Linux 下会优先使用 `XDG_CONFIG_HOME`，并补充 `~/.local/bin`、`~/.npm-global/bin`、`~/.volta/bin`、`~/.nvm/current/bin`、`/snap/bin` 等常见 PATH 目录

## 本地开发命令

### 1. 安装依赖

```bash
npm install
```

### 2. 启动前端开发服务器

```bash
npm run dev
```

默认端口为 `1420`。

### 3. 启动 Tauri 桌面开发模式

```bash
npm run tauri:dev
```

### 4. 代码检查

```bash
npm run lint
```

### 5. 运行前端单元 / 集成测试

```bash
npm run test:unit
```

### 6. 运行 E2E 测试

```bash
npm run test:e2e
```

当前 Playwright 配置已固定为单 worker，优先保证本地与 CI 的稳定性。

### 7. 构建桌面安装包

```bash
npm run tauri:build
```

## 构建产物

`npm run tauri:build` 产物位于：

- `src-tauri/target/release/bundle/nsis/ClawDesk_{version}_x64-setup.exe`（Windows NSIS）
- `src-tauri/target/release/bundle/msi/ClawDesk_{version}_x64_en-US.msi`（Windows MSI）
- `src-tauri/target/release/clawdesk.exe`（可执行文件）

GitHub Actions release 现已覆盖：

- Windows: `nsis`
- macOS: `dmg`
- Linux: `deb` + `appimage`

## 测试覆盖

当前测试分层如下（22 个测试文件，97 个用例）：

- `tests/unit`: 校验器、错误映射、诊断导出 helper、Store 测试、运行时检测
- `tests/integration`: `configService`、`installService`、`serviceService`、`settingsService`、`statusService`、领域服务 fallback
- `tests/e2e`: 安装流程、日志导出、设置保存、服务启动 / 端口冲突、Dashboard 加载
- Rust 单元测试: 诊断包 manifest、配置脱敏

## 诊断导出

`LogsPage` 当前支持两种导出方式：

- 文本诊断摘要
- ZIP 诊断包

ZIP 诊断包当前包含：

- `summary.txt`
- `manifest.json`
- `snapshots/environment.json`
- `snapshots/settings.json`
- `snapshots/gateway-status.json`
- `snapshots/openclaw-config.json`
- `logs/install.log`
- `logs/startup.log`
- `logs/gateway.log`

`openclaw-config` 快照已做脱敏处理，不会导出原始 `apiKey`。

## CI / Release

### CI

`.github/workflows/ci.yml`

- push / pull request 时执行
- 安装 Node 与 Rust
- 使用 `npm ci` 安装锁定依赖
- 运行 `npm run lint`
- 运行 `npm run test:unit`

### Release

`.github/workflows/release.yml`

- push tag `v*` 时执行
- 先执行 `lint + unit test` 作为发版门禁
- Windows 构建 `nsis`
- macOS 构建 `dmg`
- Linux 构建 `deb` 与 `appimage`
- 使用 `npm ci` 安装锁定依赖
- Linux runner 会自动安装 Tauri 官方文档要求的系统依赖
- 上传 `src-tauri/target/release/bundle/**` 作为产物

## 架构约束

- 前端页面不直接调用底层 `invoke`，统一通过 `services` 层
- 服务层拆分为 I/O 编排（`*Service.ts`）与纯逻辑（`*Parser.ts` / `*Phases.ts` / `*Issues.ts`），提高可测试性
- Rust 命令返回统一 `CommandResult<T>`
- 外部命令调用带超时、stdout/stderr/exit code
- 配置保存前自动备份
- 错误统一映射为 `error code + message + suggestion`
- 平台差异收敛在 `src-tauri/src/adapters`
- macOS / Linux 的桌面运行时会自动补充常见 PATH 目录，降低 GUI 环境找不到 `npm` / `openclaw` 的概率
- UI 组件统一使用 Tailwind CSS 工具类，不使用内联样式，全面支持暗色主题（`dark:` 变体）
- 所有用户可见文本走 i18n（react-i18next），支持中/英/日三语

## 已验证命令

以下命令已在当前工作区实际跑通：

- `npm run lint`
- `npm run test:unit`
- `npm run test:e2e`
- `node scripts/with-rust.mjs cargo check --manifest-path src-tauri/Cargo.toml`
- `node scripts/with-rust.mjs cargo test --manifest-path src-tauri/Cargo.toml`
- `npm run tauri:build`
