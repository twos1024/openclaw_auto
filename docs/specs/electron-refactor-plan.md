# ClawDesk Electron 重构方案

> **版本**: v3.0.0
> **日期**: 2026-03-21
> **状态**: ✅ 实施完成（Phase 1–6 全部完成）
> **范围**: 从 Tauri v2 (Rust) 全面迁移至 Electron (Node.js)，清理全部旧架构代码

---

## 1. 重构动机

| 维度 | Tauri (当前) | Electron (目标) |
|------|-------------|----------------|
| 后端语言 | Rust — 编译慢、团队学习曲线高 | Node.js/TypeScript — 前后端同栈 |
| IPC 机制 | `@tauri-apps/api` → Rust command handler | `ipcRenderer` / `ipcMain` — 纯 TS |
| 原生能力 | 需 Rust FFI 或 crate | Node.js 原生模块 + `child_process` |
| 打包体积 | ~8MB（小） | ~80-150MB（大但可接受） |
| 生态 | 较新、社区小 | 成熟、插件丰富 |
| 前后端类型共享 | 需手动对齐 Rust struct ↔ TS type | **同一语言，零对齐成本** |

**核心收益**：前后端统一为 TypeScript，消除 Rust 编译链、简化 CI、降低维护成本。

---

## 2. 当前架构概览

```
┌─────────────────────────────────────────────┐
│  L1: React + Vite + Zustand (Renderer)      │
│  src/pages, src/components, src/store       │
├─────────────────────────────────────────────┤
│  L2: IPC Bridge (tauriClient.ts)            │
│  @tauri-apps/api/core.invoke()              │
├─────────────────────────────────────────────┤
│  L3: Rust Backend (src-tauri/)              │
│  commands/ → services/ → adapters/          │
│  Tokio async, reqwest, serde, zip           │
└─────────────────────────────────────────────┘
```

**关键数字**：
- Rust 后端：20+ IPC command handlers，17+ services，4 adapters
- 前端：~12,249 行 TS/TSX
- 前端 service 层通过 `tauriClient.ts` 的 `invokeCommand<T>()` 统一调用后端

---

## 3. 目标架构

```
┌─────────────────────────────────────────────┐
│  Renderer Process (React + Vite + Zustand)  │
│  src/pages, src/components, src/store       │
├─────────────────────────────────────────────┤
│  Preload Script (contextBridge)             │
│  src/preload/index.ts — 暴露安全 API        │
├─────────────────────────────────────────────┤
│  Main Process (Node.js / TypeScript)        │
│  src/main/                                  │
│  ├── ipc/        IPC handler 注册           │
│  ├── services/   业务逻辑 (TS 重写)          │
│  ├── adapters/   shell/platform/file_ops    │
│  └── models/     错误类型、结果类型           │
└─────────────────────────────────────────────┘
```

### 3.1 目录结构（目标态）

```
clawdesk/
├── package.json                  # 统一依赖
├── electron-builder.yml          # Electron Builder 打包配置
├── vite.config.ts                # Renderer 构建（保留）
├── vite.main.config.ts           # Main process TS 编译
├── vite.preload.config.ts        # Preload script TS 编译
│
├── src/
│   ├── main/                     # ← Electron Main Process（替代 src-tauri/）
│   │   ├── index.ts              # app 生命周期 + BrowserWindow
│   │   ├── ipc/                  # IPC handler 注册（1:1 对应旧 Rust commands/）
│   │   │   ├── index.ts          # 统一注册所有 handler
│   │   │   ├── agent.ts
│   │   │   ├── channel.ts
│   │   │   ├── provider.ts
│   │   │   ├── cron.ts
│   │   │   ├── admin.ts
│   │   │   ├── env.ts
│   │   │   ├── install.ts
│   │   │   ├── connectivity.ts
│   │   │   ├── config.ts
│   │   │   ├── gateway.ts
│   │   │   ├── logs.ts
│   │   │   ├── settings.ts
│   │   │   ├── overview.ts
│   │   │   └── runbook.ts
│   │   ├── services/             # 业务逻辑（从 Rust 翻译为 TS）
│   │   │   ├── install-service.ts
│   │   │   ├── gateway-service.ts
│   │   │   ├── config-service.ts
│   │   │   ├── log-service.ts
│   │   │   ├── env-service.ts
│   │   │   ├── overview-service.ts
│   │   │   ├── runbook-service.ts
│   │   │   ├── admin-service.ts
│   │   │   ├── agent-service.ts
│   │   │   ├── channel-service.ts
│   │   │   ├── provider-service.ts
│   │   │   ├── cron-service.ts
│   │   │   ├── connectivity-service.ts
│   │   │   └── gateway-api-service.ts
│   │   ├── adapters/             # 平台抽象
│   │   │   ├── shell.ts          # child_process 封装（替代 Rust shell.rs）
│   │   │   ├── platform.ts       # 平台检测（替代 Rust platform.rs）
│   │   │   ├── openclaw.ts       # OpenClaw CLI 封装
│   │   │   └── file-ops.ts       # 文件操作（替代 Rust file_ops.rs）
│   │   └── models/               # 共享类型
│   │       ├── error.ts          # AppError + ErrorCode
│   │       └── result.ts         # CommandResult<T>
│   │
│   ├── preload/                  # ← Preload 安全桥
│   │   └── index.ts              # contextBridge.exposeInMainWorld('api', {...})
│   │
│   ├── renderer/                 # ← 现有前端代码迁移至此（原 src/ 下的前端文件）
│   │   ├── main.tsx
│   │   ├── AppRuntime.tsx
│   │   ├── router.tsx
│   │   ├── components/
│   │   ├── pages/
│   │   ├── store/
│   │   ├── services/             # 前端 service 层
│   │   │   ├── ipcClient.ts      # ← 替代 tauriClient.ts
│   │   │   └── ...其余 service 文件
│   │   ├── hooks/
│   │   ├── lib/
│   │   ├── types/
│   │   ├── i18n/
│   │   ├── styles/
│   │   └── utils/
│   │
│   └── shared/                   # ← 前后端共享类型（新增）
│       ├── ipc-channels.ts       # IPC channel 名称常量
│       └── types/                # 共享 TS 接口 (替代 Rust models + TS types 双写)
│           ├── agent.ts
│           ├── api.ts
│           ├── channel.ts
│           ├── config.ts
│           ├── gateway.ts
│           ├── install.ts
│           ├── logs.ts
│           ├── provider.ts
│           ├── settings.ts
│           └── ...
│
├── tests/                        # 测试（保留+适配）
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── resources/                    # 应用图标、静态资源
│   └── icons/
│
└── docs/
```

---

## 4. IPC 迁移映射

### 4.1 Bridge 层替换

| 旧 (Tauri) | 新 (Electron) |
|---|---|
| `@tauri-apps/api/core.invoke('command', payload)` | `window.api.invoke('command', payload)` |
| `tauriClient.ts` → `invokeCommand<T>()` | `ipcClient.ts` → `invokeCommand<T>()` |
| Rust `#[tauri::command]` | `ipcMain.handle('channel', handler)` |

### 4.2 新 ipcClient.ts（替代 tauriClient.ts）

```typescript
// src/renderer/services/ipcClient.ts
import type { CommandResult, BackendError } from '@shared/types/api';

export async function invokeCommand<T>(
  command: string,
  payload?: Record<string, unknown>,
): Promise<CommandResult<T>> {
  try {
    return await window.api.invoke<CommandResult<T>>(command, payload);
  } catch (error: unknown) {
    return {
      success: false,
      error: {
        code: 'E_INVOKE',
        message: error instanceof Error ? error.message : `Failed to invoke: ${command}`,
        suggestion: 'Ensure the Electron main process is running.',
      },
    };
  }
}
```

### 4.3 新 Preload Script

```typescript
// src/preload/index.ts
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  invoke: <T>(channel: string, payload?: Record<string, unknown>): Promise<T> =>
    ipcRenderer.invoke(channel, payload),
  on: (channel: string, callback: (...args: unknown[]) => void) => {
    ipcRenderer.on(channel, (_event, ...args) => callback(...args));
  },
  removeListener: (channel: string, callback: (...args: unknown[]) => void) => {
    ipcRenderer.removeListener(channel, callback);
  },
});
```

### 4.4 全部 IPC Command 映射表

以下 20+ Rust command 将 1:1 翻译为 Electron IPC handler：

| IPC Channel | 旧实现 (Rust) | 新实现 (TS) |
|---|---|---|
| `list_agents` | `commands::agent` → `agent_service` | `ipc/agent.ts` → `services/agent-service.ts` |
| `create_agent` | 同上 | 同上 |
| `update_agent` | 同上 | 同上 |
| `delete_agent` | 同上 | 同上 |
| `start_agent` | 同上 | 同上 |
| `stop_agent` | 同上 | 同上 |
| `list_channels` | `commands::channel` → `channel_service` | `ipc/channel.ts` → `services/channel-service.ts` |
| `add_channel` | 同上 | 同上 |
| `update_channel` | 同上 | 同上 |
| `delete_channel` | 同上 | 同上 |
| `list_providers` | `commands::provider` → `provider_service` | `ipc/provider.ts` → `services/provider-service.ts` |
| `create_provider` | 同上 | 同上 |
| `update_provider` | 同上 | 同上 |
| `delete_provider` | 同上 | 同上 |
| `validate_provider` | 同上 | 同上 |
| `list_cron_jobs` | `commands::cron` → `cron_service` | `ipc/cron.ts` → `services/cron-service.ts` |
| `create_cron_job` | 同上 | 同上 |
| `update_cron_job` | 同上 | 同上 |
| `delete_cron_job` | 同上 | 同上 |
| `trigger_cron_job` | 同上 | 同上 |
| `check_admin_status` | `commands::admin` → `admin_service` | `ipc/admin.ts` → `services/admin-service.ts` |
| `relaunch_as_admin` | 同上 | 同上 |
| `detect_env` | `commands::env` → `env_service` | `ipc/env.ts` → `services/env-service.ts` |
| `install_openclaw` | `commands::install` → `install_service` | `ipc/install.ts` → `services/install-service.ts` |
| `install_openclaw_in_terminal` | 同上 (visible terminal) | 同上 (`child_process` + terminal) |
| `test_connection` | `commands::connectivity` | `ipc/connectivity.ts` → `services/connectivity-service.ts` |
| `backup_openclaw_config` | `commands::config` → `config_service` | `ipc/config.ts` → `services/config-service.ts` |
| `read_openclaw_config` | 同上 | 同上 |
| `write_openclaw_config` | 同上 | 同上 |
| `get_gateway_status` | `commands::gateway` → `gateway_service` | `ipc/gateway.ts` → `services/gateway-service.ts` |
| `start_gateway` | 同上 | 同上 |
| `stop_gateway` | 同上 | 同上 |
| `restart_gateway` | 同上 | 同上 |
| `open_dashboard` | 同上 (`shell::open`) | 同上 (`shell.openExternal`) |
| `probe_dashboard_endpoint` | 同上 (`reqwest`) | 同上 (`node-fetch` / `undici`) |
| `read_logs` | `commands::logs` → `log_service` | `ipc/logs.ts` → `services/log-service.ts` |
| `export_diagnostics` | 同上 (`zip` crate) | 同上 (`archiver` / `yazl`) |
| `read_app_settings` | `commands::settings` | `ipc/settings.ts` → `services/settings-service.ts` |
| `write_app_settings` | 同上 | 同上 |
| `get_overview_status` | `commands::overview` | `ipc/overview.ts` → `services/overview-service.ts` |
| `get_runbook_model` | `commands::runbook` | `ipc/runbook.ts` → `services/runbook-service.ts` |

---

## 5. Rust → TypeScript 关键翻译对照

### 5.1 Shell 执行（adapters/shell.ts）

| Rust (shell.rs) | TypeScript (shell.ts) |
|---|---|
| `tokio::process::Command` | `child_process.execFile` / `spawn` |
| `timeout(Duration, child.wait_with_output())` | `AbortController` + `setTimeout` |
| `#[cfg(windows)] CREATE_NO_WINDOW` | `windowsHide: true` option |
| `kill_on_drop(true)` | `child.kill()` in cleanup |
| `kill_process_tree_windows(pid)` | `taskkill /F /T /PID` via `execSync` |
| `platform::normalized_path_env()` | `process.env.PATH` + platform supplement |

### 5.2 HTTP 客户端

| Rust | TypeScript |
|---|---|
| `reqwest::Client` | Node.js `fetch` (v18+) 或 `undici` |
| `reqwest::Url::parse` | `new URL()` |
| Timeout via `reqwest::Client::builder().timeout()` | `AbortSignal.timeout()` |

### 5.3 文件 & ZIP 操作

| Rust | TypeScript |
|---|---|
| `tokio::fs::read_to_string` | `fs/promises.readFile` |
| `tokio::fs::write` | `fs/promises.writeFile` |
| `zip::ZipWriter` | `archiver` npm 包 |
| `serde_json::from_str` / `to_string_pretty` | `JSON.parse` / `JSON.stringify` |
| `json5::from_str` | `json5` npm 包 |

### 5.4 错误模型

```typescript
// src/main/models/error.ts — 直接复用现有 ErrorCode 体系
export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public suggestion: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

// ErrorCode 枚举保持不变，直接从 Rust 移植
export enum ErrorCode {
  ShellSpawnFailed = 'E_SHELL_SPAWN',
  ShellTimeout = 'E_SHELL_TIMEOUT',
  ShellWaitFailed = 'E_SHELL_WAIT',
  GatewayStatusFailed = 'E_GW_STATUS',
  GatewayStartFailed = 'E_GW_START',
  GatewayStopFailed = 'E_GW_STOP',
  GatewayNotRunning = 'E_GW_NOT_RUNNING',
  PortConflict = 'E_PORT_CONFLICT',
  DashboardOpenFailed = 'E_DASH_OPEN',
  InvalidInput = 'E_INVALID_INPUT',
  InternalError = 'E_INTERNAL',
  // ... 其余保持一致
}
```

---

## 6. 需要清理的旧代码

### 6.1 完全删除

| 路径 | 说明 |
|---|---|
| `src-tauri/` | 整个 Rust 后端目录 |
| `src-tauri/Cargo.toml` | Rust 依赖 |
| `src-tauri/Cargo.lock` | Rust 锁文件 |
| `src-tauri/src/**` | 全部 Rust 源码 |
| `src-tauri/build.rs` | Tauri 构建脚本 |
| `src-tauri/icons/` | 迁移至 `resources/icons/` 后删除 |
| `src-tauri/tauri.conf.json` | Tauri 配置（如存在） |
| `scripts/with-rust.mjs` | Rust 工具链检查脚本 |

### 6.2 替换 / 重写

| 文件 | 操作 |
|---|---|
| `src/services/tauriClient.ts` | → `src/renderer/services/ipcClient.ts` |
| `src/types/api.ts` | → `src/shared/types/api.ts`（移至共享） |
| `package.json` | 移除 `@tauri-apps/*` 依赖，添加 `electron`, `electron-builder` 等 |
| `vite.config.ts` | 移除 Tauri 相关配置，适配 Electron renderer |
| `.github/workflows/ci.yml` | 移除 Rust 编译步骤，添加 Electron 构建 |
| `.github/workflows/release.yml` | 改用 `electron-builder` 多平台打包 |

### 6.3 前端代码适配（改动小）

前端 service 层通过 `invokeCommand<T>()` 封装调用后端，**只需替换 import 路径**：

```diff
- import { invokeCommand } from './tauriClient';
+ import { invokeCommand } from './ipcClient';
```

其余 React 组件、Zustand stores、hooks、pages **无需改动**（IPC 接口签名保持一致）。

---

## 7. 依赖变更

### 7.1 移除

```
@tauri-apps/api          → 删除
@tauri-apps/cli          → 删除
```

### 7.2 新增

```
# 核心
electron                 → ^33.x (latest stable)
electron-builder         → ^25.x (打包工具)

# Main process 构建
vite-plugin-electron     → ^0.28.x (Vite 集成 Electron)
vite-plugin-electron-renderer → ^0.14.x

# Main process 依赖
archiver                 → ^7.x (ZIP 打包，替代 Rust zip crate)
json5                    → ^2.x (JSON5 解析，替代 Rust json5 crate)
electron-log             → ^5.x (日志，可选)
electron-store           → ^10.x (设置持久化，可选)
```

### 7.3 保留不变

```
react, react-dom, react-router-dom    # UI 框架
zustand                               # 状态管理
vite, @vitejs/plugin-react            # 构建
tailwindcss, @tailwindcss/vite        # 样式
i18next, react-i18next                # 国际化
lucide-react, @radix-ui/*             # UI 组件
framer-motion                         # 动画
vitest, @playwright/test              # 测试
eslint, typescript                    # 开发工具
```

---

## 8. 构建 & 打包

### 8.1 开发模式

```bash
# 启动 Electron 开发模式（Vite HMR + Main process 热重载）
npm run dev
# 内部：vite-plugin-electron 同时编译 main + preload + renderer
```

### 8.2 生产构建

```bash
npm run build       # Vite 构建 renderer + tsc 编译 main/preload
npm run package     # electron-builder 打包
```

### 8.3 electron-builder.yml

```yaml
appId: com.openclaw.clawdesk
productName: ClawDesk
directories:
  output: dist-electron
  buildResources: resources

files:
  - dist/**/*           # Vite renderer output
  - dist-main/**/*      # Main process compiled output
  - dist-preload/**/*   # Preload compiled output

win:
  target: [nsis, portable]
  icon: resources/icons/icon.ico

mac:
  target: [dmg, zip]
  icon: resources/icons/icon.icns
  category: public.app-category.developer-tools

linux:
  target: [AppImage, deb]
  icon: resources/icons
  category: Development
```

---

## 9. CI/CD 变更

### 9.1 CI Pipeline (新)

```yaml
# .github/workflows/ci.yml
jobs:
  lint-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm run lint
      - run: npm run test:unit
      # 不再需要 Rust toolchain setup
```

### 9.2 Release Pipeline (新)

```yaml
# .github/workflows/release.yml
jobs:
  build:
    strategy:
      matrix:
        os: [windows-latest, macos-latest, ubuntu-22.04]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm run build
      - run: npx electron-builder --publish never
      - uses: actions/upload-artifact@v4
        with:
          name: clawdesk-${{ matrix.os }}
          path: dist-electron/*
```

**CI 收益**：
- 移除 Rust 编译步骤 → CI 时间从 ~8-12 分钟降至 ~3-5 分钟
- 移除 Windows Rust test job
- 移除 Linux 系统依赖安装（libwebkit2gtk 等）

---

## 10. 安全模型

### 10.1 Electron 安全最佳实践

```typescript
// src/main/index.ts
const mainWindow = new BrowserWindow({
  webPreferences: {
    preload: path.join(__dirname, '../preload/index.js'),
    contextIsolation: true,       // 必须开启
    nodeIntegration: false,       // 必须关闭
    sandbox: true,                // 沙箱模式
    webSecurity: true,            // CSP
  },
});
```

### 10.2 IPC 安全

- Preload 只暴露白名单 API（`invoke`, `on`, `removeListener`）
- Main process 校验所有 IPC channel 名称
- 敏感操作（admin elevation、config write）增加二次确认

---

## 11. 实施路线图

### Phase 1: 脚手架搭建（1-2 天）

- [ ] 初始化 Electron + Vite 集成配置
- [ ] 创建 `src/main/index.ts` — app 生命周期 + BrowserWindow
- [ ] 创建 `src/preload/index.ts` — contextBridge
- [ ] 移动前端代码 `src/` → `src/renderer/`
- [ ] 创建 `src/shared/` 共享类型目录
- [ ] 配置 `vite.config.ts` 适配 Electron renderer
- [ ] 验证：Electron 窗口可加载 React 页面

### Phase 2: IPC 桥接层（1 天）

- [ ] 实现 `src/renderer/services/ipcClient.ts`
- [ ] 批量替换所有 `tauriClient` import → `ipcClient`
- [ ] 创建 `src/shared/ipc-channels.ts` 常量定义
- [ ] 创建 `src/main/ipc/index.ts` 统一注册框架
- [ ] 验证：前端 invokeCommand 可达 main process

### Phase 3: 后端服务翻译（3-5 天）

按优先级分批翻译 Rust service → TypeScript：

**批次 1 — 核心基础（Day 1）**
- [ ] `adapters/shell.ts` — child_process 封装
- [ ] `adapters/platform.ts` — 平台检测
- [ ] `adapters/file-ops.ts` — 文件操作
- [ ] `adapters/openclaw.ts` — CLI 封装
- [ ] `models/error.ts` + `models/result.ts`

**批次 2 — 关键服务（Day 2-3）**
- [ ] `services/env-service.ts` — 环境检测
- [ ] `services/install-service.ts` — 安装流程
- [ ] `services/gateway-service.ts` — 网关管理（最复杂，含缓存）
- [ ] `services/config-service.ts` — 配置读写
- [ ] `services/log-service.ts` — 日志 & 诊断导出
- [ ] `services/settings-service.ts` — 应用设置

**批次 3 — CRUD 服务（Day 4）**
- [ ] `services/agent-service.ts`
- [ ] `services/channel-service.ts`
- [ ] `services/provider-service.ts`
- [ ] `services/cron-service.ts`
- [ ] `services/connectivity-service.ts`

**批次 4 — 辅助服务（Day 5）**
- [ ] `services/admin-service.ts`
- [ ] `services/overview-service.ts`
- [ ] `services/runbook-service.ts`
- [ ] `services/gateway-api-service.ts`
- [ ] 全部 IPC handler 注册（`ipc/*.ts`）

### Phase 4: 旧代码清理（0.5 天）

- [ ] 删除 `src-tauri/` 整个目录
- [ ] 删除 `scripts/with-rust.mjs`
- [ ] 移除 `package.json` 中 `@tauri-apps/*` 依赖
- [ ] 移除 `package.json` 中所有 `tauri:*` scripts
- [ ] 清理 `.gitignore` 中 Rust/Cargo 相关条目
- [ ] 迁移 `src-tauri/icons/` → `resources/icons/`
- [ ] 更新文档引用

### Phase 5: 测试 & CI 适配（1-2 天）

- [ ] 适配 unit tests（mock IPC 层）
- [ ] 新增 main process service 单元测试
- [ ] 适配 E2E tests（Playwright → Electron）
- [ ] 翻译 Rust 单元测试 → TypeScript（gateway_service 等）
- [ ] 更新 CI workflow（移除 Rust，添加 Electron）
- [ ] 更新 Release workflow（electron-builder）

### Phase 6: 打包 & 验收（1 天）

- [ ] electron-builder 配置 Windows/macOS/Linux 打包
- [ ] 各平台安装包测试
- [ ] 全功能回归测试
- [ ] 版本号升级至 v3.0.0
- [ ] 更新 Release Notes

---

## 12. 风险 & 缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 包体积增大 (~80MB vs ~8MB) | 用户下载体验 | 使用 `electron-builder` 的 ASAR 打包 + 压缩 |
| Gateway 缓存逻辑翻译复杂 | 功能回归 | 逐函数翻译 + 对比测试 |
| Windows 进程树管理 | 孤儿进程 | 保留 `taskkill /F /T /PID` 逻辑 |
| Electron 安全模型差异 | 安全漏洞 | 严格 contextIsolation + sandbox |
| E2E 测试适配 | 测试覆盖率下降 | Playwright Electron support 或迁移到 Spectron |
| 前端 import 路径变更 | 构建失败 | 使用 Vite alias 保持 `@/` 前缀 |

---

## 13. 成功指标

- [ ] 全部 20+ IPC command 功能等价
- [ ] 前端 React 代码零逻辑改动（仅 import 路径变更）
- [ ] CI 通过（lint + unit test + build）
- [ ] Windows / macOS / Linux 三平台打包成功
- [ ] `src-tauri/` 目录完全移除，项目无 Rust 依赖
- [ ] 现有 E2E 测试全部通过

---

## 14. 文件变更总量预估

| 类别 | 文件数 | 说明 |
|------|--------|------|
| 新增 (main process) | ~25 | IPC handlers + services + adapters |
| 新增 (preload) | 1 | contextBridge |
| 新增 (shared types) | ~10 | 前后端共享类型 |
| 新增 (配置) | ~5 | Electron Builder, Vite main/preload configs |
| 修改 (renderer) | ~20 | import 路径替换 + 去 Tauri 引用 |
| 删除 (Tauri/Rust) | ~30+ | 整个 src-tauri/ + scripts |
| **总计** | **~90** | |

---

> **下一步**：确认方案后立即进入 Phase 1 脚手架搭建。
