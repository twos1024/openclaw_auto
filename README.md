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
- 管理 ClawDesk 自身设置
- 在 Overview 页聚合展示当前健康状态和推荐下一步动作

## 当前页面

- `OverviewPage`: 聚合健康状态、推荐下一步动作、支持直接打开 Dashboard
- `DashboardPage`: 内嵌 Dashboard、外部打开、页面加载诊断、平台排障提示
- `InstallPage`: 环境检查、安装阶段时间线、安装结果提示、Install Wizard、平台安装指导
- `ConfigPage`: OpenAI-compatible / Ollama 配置、校验、测试连接、自动备份后保存
- `ServicePage`: Gateway 启停、轮询状态、端口冲突提示、打开 Dashboard
- `LogsPage`: 日志查看、关键字过滤、错误摘要、导出文本诊断、导出 ZIP 诊断包
- `SettingsPage`: 诊断目录、日志行数限制、Gateway 轮询间隔、安装源偏好

全局对话框：

- `Setup Assistant`: 即时 launch check、引导式下一步动作、可直接深链到 Install Wizard

## 目录结构

```text
src/
  components/
  hooks/
  pages/
  services/
  types/
  utils/
src-tauri/
  src/
    adapters/
    commands/
    models/
    services/
tests/
  unit/
  integration/
  e2e/
docs/specs/
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

在当前 Windows 本地环境里，`npm run tauri:build` 已验证通过，产物位于：

- `src-tauri/target/release/bundle/msi/ClawDesk_0.1.4_x64_en-US.msi`
- `src-tauri/target/release/bundle/nsis/ClawDesk_0.1.4_x64-setup.exe`

可执行文件位于：

- `src-tauri/target/release/clawdesk.exe`

额外已验证：

- `ClawDesk_0.1.4_x64-setup.exe` 可静默安装到临时目录
- 安装后的 `clawdesk.exe` 可成功启动
- 静默卸载与目录清理可完成

GitHub Actions release 现已覆盖：

- Windows: `nsis`
- macOS: `dmg`
- Linux: `deb` + `appimage`

## 测试覆盖

当前测试分层如下：

- `tests/unit`: 校验器、错误映射、诊断导出 helper
- `tests/integration`: `configService`、`installService`、`settingsService`、`statusService`
- `tests/e2e`: 安装流程、日志导出、设置保存、服务启动 / 端口冲突
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

## 重要实现约束

- 前端页面不直接调用底层 `invoke`，统一通过 `services` 层
- Rust 命令返回统一 `CommandResult<T>`
- 外部命令调用带超时、stdout/stderr/exit code
- 配置保存前自动备份
- 错误统一映射为 `error code + message + suggestion`
- 平台差异收敛在 `src-tauri/src/adapters`
- macOS / Linux 的桌面运行时会自动补充常见 PATH 目录，降低 GUI 环境找不到 `npm` / `openclaw` 的概率

## 已验证命令

以下命令已在当前工作区实际跑通：

- `npm run lint`
- `npm run test:unit`
- `npm run test:e2e`
- `node scripts/with-rust.mjs cargo check --manifest-path src-tauri/Cargo.toml`
- `node scripts/with-rust.mjs cargo test --manifest-path src-tauri/Cargo.toml`
- `npm run tauri:build`
