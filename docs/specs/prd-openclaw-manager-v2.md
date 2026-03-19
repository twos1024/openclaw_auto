# ClawDesk / OpenClaw 首次安装与首启 PRD

> 说明：本文件保留历史文件名以减少仓库迁移成本，但内容已切换为 ClawDesk 的真实首启产品需求。
>
> 目标版本：v2.0.0
> 日期：2026-03-20

---

## 1. 产品定义

ClawDesk 是一个桌面端安装器与控制面板，负责把用户从“未安装、未配置、未启动”带到“OpenClaw 已安装、API Key 已配置、Gateway 已启动、Dashboard 可访问”的可用状态。

### 1.1 产品目标

1. 自动完成运行环境检测与补齐。
2. 安装或升级到官方最新稳定版 OpenClaw。
3. 引导用户完成 OpenAI-compatible API Key、Base URL、Model ID 的首次配置。
4. 安装并启动 Gateway，完成健康检查。
5. 直接打开本地 Dashboard，让用户开始使用。

### 1.2 产品边界

ClawDesk 的首启流程只负责“把 OpenClaw 跑起来并能访问 Dashboard”。

不在首启流程内完成的内容：

1. Provider 的完整生命周期管理。
2. Agent、Channel、Skill、Cron 的业务配置。
3. 远程云端账号体系。
4. 对外暴露公网 Dashboard。

这些能力可在 Gateway 运行后进入主应用再进行管理。

---

## 2. 官方 OpenClaw 最佳实践

以下是本产品必须对齐的官方文档要点，作为实现与 QA 的共同基线：

1. 官方推荐优先使用安装脚本完成安装，因为脚本会自动检测并安装 Node，还会处理 onboarding 流程。
2. 官方要求 Node 22+。
3. 对于 API Key / 自定义模型接入，官方 onboarding 支持 `custom-api-key`、`custom-base-url`、`custom-model-id`、`custom-compatibility openai` 这一类非交互参数。
4. Gateway 是本地运行时与控制面的事实来源，ClawDesk 只做本地控制与引导，不把自己当成数据源。
5. Dashboard 是 Gateway 启动后提供的本地控制 UI，正确顺序是先完成安装和 onboarding，再启动 Gateway，再进入 Dashboard。
6. 在 Windows 场景下，优先保证本地桌面运行与 PATH 可见性；不要要求用户手工处理复杂环境变量。

参考链接：

- [Install](https://docs.openclaw.ai/install)
- [Node.js](https://docs.openclaw.ai/install/node)
- [Getting Started](https://docs.openclaw.ai/start/getting-started)
- [Onboarding CLI Reference](https://docs.openclaw.ai/start/wizard-cli-reference)
- [Onboarding Overview](https://docs.openclaw.ai/start/onboarding-overview)
- [Gateway Configuration Reference](https://docs.openclaw.ai/gateway/configuration-reference)

---

## 3. 现状架构 mismatch

当前仓库里仍能看到旧的首启路径与新的目标路径不一致：

1. 现有 Setup 相关页面还存在 provider-first 的流程痕迹。
2. 现有实现里，创建 provider 的后备逻辑仍依赖 Gateway 可用，这会在首次安装前失败。
3. 当前配置模型仍偏向简化 JSON 字段，而官方 OpenClaw 更接近 onboarding / gateway 配置的真实结构。

本 PRD 以“安装器优先、Gateway 先启动、Provider 配置后置”为目标流程，作为重构方向的唯一标准。

---

## 4. 目标用户与场景

### 4.1 用户画像

| 用户 | 目标 | 主要痛点 |
|------|------|----------|
| 首次安装用户 | 一次性跑通 OpenClaw | 不想手动装 Node / npm，不想在多个页面反复确认 |
| 开发者 | 快速接入 OpenAI-compatible 模型 | 需要清晰的 Base URL、Key、Model 配置入口 |
| 维护者 | 批量排障和验证安装状态 | 需要可见的安装日志、健康检查、错误指引 |

### 4.2 典型场景

1. 新机器首次启动 ClawDesk。
2. 旧机器升级到最新 OpenClaw。
3. 用户只提供 OpenAI-compatible API Key，希望快速完成对接。
4. Gateway 未运行时，用户希望一键启动并进入 Dashboard。

---

## 5. 首次安装主流程

### 5.1 用户路径

`欢迎 -> 环境检查 -> 安装 OpenClaw -> 配置 OpenAI-compatible API Key -> 安装并启动 Gateway -> 打开 Dashboard`

### 5.2 每一步的产品目标

#### Step 1. 欢迎

目标：

1. 明确告诉用户只需要跟着一步一步走。
2. 告诉用户 ClawDesk 会自动检查和补齐环境。
3. 告诉用户最后会自动打开 Dashboard。

验收点：

1. 首屏能清楚展示安装顺序。
2. 用户可以看见当前进度与下一步。

#### Step 2. 环境检查与 bootstrap

目标：

1. 检测 Node 22+、npm、OpenClaw CLI、可执行路径、权限与网络可达性。
2. 如果缺少 Node 或 npm，自动执行环境补齐或调用官方安装脚本路径。
3. 如果 PATH 不可见，自动修正或给出无需手工猜测的修复动作。

验收点：

1. 无需用户自己打开终端检查版本。
2. 环境缺失时能给出可执行的自动修复结果。
3. 环境已满足时自动进入下一步，不要求手工确认。

#### Step 3. 安装 OpenClaw

目标：

1. 安装官方最新稳定版 OpenClaw。
2. 安装完成后自动做版本校验。
3. 支持已安装时跳过，但仍要确认版本符合要求。

验收点：

1. 版本号在 UI 中可见。
2. 安装失败时能定位到命令、超时、网络、权限或 PATH 问题。

#### Step 4. 配置 OpenAI-compatible API

目标：

1. 让用户输入 API Key。
2. 支持可选 Base URL 和 Model ID。
3. 默认按 OpenAI-compatible 模式处理自定义后端。
4. 保存前可做最小可用性校验。

验收点：

1. 该步骤不要求用户先创建 Provider 列表。
2. 输入内容可掩码显示。
3. 校验失败时提示用户修正字段，而不是让流程中断在 Gateway 相关错误上。

#### Step 5. 安装并启动 Gateway

目标：

1. 安装或注册 Gateway 运行方式。
2. 启动 Gateway 后执行健康检查。
3. 显示地址、端口、PID 或等价状态信息。

验收点：

1. Gateway 未启动前不能进入 Dashboard。
2. 启动成功后自动进入下一步。
3. 失败时能识别端口占用、命令失败、版本不匹配等问题。

#### Step 6. 打开 Dashboard

目标：

1. 打开本地 Dashboard。
2. 如果内嵌失败，提供外部浏览器打开入口。
3. 保证用户能立刻开始使用。

验收点：

1. Dashboard 入口只能在 Gateway 已就绪后激活。
2. 打开外部 Dashboard 时要明确来源是本地 Gateway。

---

## 6. 功能需求

### 6.1 环境检测

| 需求 | 说明 | 优先级 |
|------|------|--------|
| Node 检测 | 检测 Node 22+ | P0 |
| npm 检测 | 检测 npm 是否可用 | P0 |
| OpenClaw CLI 检测 | 检测 `openclaw` 是否已安装并可执行 | P0 |
| PATH 检测 | 检测全局 CLI 是否在 PATH 可见 | P0 |
| 平台检测 | 识别 Windows / macOS / Linux | P0 |
| 权限检测 | 识别需要管理员权限或写入权限不足 | P0 |
| 网络检测 | 在安装前做最基本网络可达性探测 | P1 |

### 6.2 环境补齐

| 需求 | 说明 | 优先级 |
|------|------|--------|
| 自动补齐 Node | Node 缺失时自动进入补齐流程 | P0 |
| 自动补齐 PATH | npm 全局路径不可见时给出自动修复动作 | P0 |
| 自动重试 | 补齐完成后自动重新检测，不要求用户手动刷新 | P0 |
| 安装日志 | 显示环境补齐过程与结果 | P0 |

### 6.3 OpenClaw 安装

| 需求 | 说明 | 优先级 |
|------|------|--------|
| 最新版安装 | 默认安装官方最新稳定版 | P0 |
| 已安装检测 | 如果已存在可用版本，先校验再决定是否升级 | P0 |
| 版本展示 | 显示安装后版本 | P0 |
| 失败归因 | 识别超时、权限、网络、二进制缺失等失败 | P0 |

### 6.4 OpenAI-compatible 配置

| 需求 | 说明 | 优先级 |
|------|------|--------|
| API Key 输入 | 允许用户输入自定义 API Key | P0 |
| Base URL | 支持可选 Base URL | P0 |
| Model ID | 支持可选模型标识 | P0 |
| 兼容模式 | 默认按 OpenAI-compatible 处理 | P0 |
| 掩码展示 | 保存后只展示掩码 | P0 |
| 校验动作 | 保存前做最小格式校验 | P0 |
| 失败恢复 | 配置失败时返回当前步骤，不丢失已填字段 | P0 |

### 6.5 Gateway 安装与启动

| 需求 | 说明 | 优先级 |
|------|------|--------|
| 安装 Gateway | 安装或注册 Gateway 所需运行文件 | P0 |
| 启动 Gateway | 安装后自动启动或允许一键启动 | P0 |
| 健康检查 | 启动后主动探测本地状态 | P0 |
| 状态展示 | 展示运行中、停止、启动中、失败等状态 | P0 |
| 端口冲突识别 | 明确提示端口被占用 | P0 |

### 6.6 Dashboard 访问

| 需求 | 说明 | 优先级 |
|------|------|--------|
| 内嵌访问 | Gateway 就绪后自动加载 Dashboard | P0 |
| 外部打开 | 内嵌失败时提供浏览器打开入口 | P0 |
| 本地限定 | 只允许访问本机地址 | P0 |
| 访问反馈 | 显示打开结果、失败原因和重试入口 | P1 |

---

## 7. 信息架构

### 7.1 首启页面结构

| 区块 | 内容 |
|------|------|
| 顶部标题区 | 产品名、当前状态、步骤进度 |
| 中部主卡片 | 当前步骤的表单/检查/安装结果 |
| 右侧或底部信息区 | 当前环境摘要、版本、日志摘要、提示 |
| 底部操作区 | 上一步、下一步、重试、打开 Dashboard |

### 7.2 关键状态

| 状态 | 含义 |
|------|------|
| `not_started` | 尚未开始首启 |
| `checking_env` | 正在检测环境 |
| `bootstrapping_env` | 正在补齐环境 |
| `installing_openclaw` | 正在安装 OpenClaw |
| `configuring_api` | 正在配置 API |
| `installing_gateway` | 正在安装或注册 Gateway |
| `starting_gateway` | 正在启动 Gateway |
| `gateway_ready` | Gateway 已就绪 |
| `dashboard_opened` | Dashboard 已打开 |
| `failed` | 当前步骤失败，可重试 |

---

## 8. 非功能需求

| 维度 | 要求 |
|------|------|
| 自动化 | 首启流程不能依赖用户自己完成命令行安装确认 |
| 可恢复 | 任一步失败后，用户可在当前页重试，不要求重开应用 |
| 安全 | API Key 不得明文落盘或写入普通日志 |
| 可观测 | 每一步都要有状态、日志摘要和失败原因 |
| 兼容性 | 支持 Windows 为主，macOS / Linux 为辅 |
| 时效性 | 安装与版本展示必须基于运行时实际检测结果，而不是静态文案 |
| 易用性 | 用户不应看到 provider-first、渠道先行或其它与首启无关的概念 |

---

## 9. 验收标准

### 9.1 主流程验收

1. 在干净环境下启动 ClawDesk，能自动进入首启向导。
2. 缺少 Node / npm / OpenClaw 时，能在向导中自动处理或给出明确、可执行的补齐结果。
3. 用户只需填写 OpenAI-compatible API Key 和必要的基础字段，就能继续完成安装。
4. Gateway 安装并启动后，健康检查必须通过。
5. Gateway 就绪后，Dashboard 必须能打开。

### 9.2 异常流程验收

1. 安装失败必须给出原因分类和下一步建议。
2. 端口冲突必须被识别并提示。
3. API Key 无效时必须停留在配置步骤，不应进入 Dashboard。
4. 版本过旧或不匹配时必须提示升级。

---

## 10. 旧架构到新流程的映射

| 旧说法 / 旧入口 | 新说法 / 新入口 |
|------|------|
| Provider-first Setup | 环境 -> 安装 -> API 配置 -> Gateway -> Dashboard |
| 先创建 Provider | 先保存 OpenAI-compatible 配置 |
| 依赖 Gateway 的 provider 创建 | 首启不依赖 Gateway 先存在 |
| 抽象的“完成初始化” | 明确的 Dashboard 可访问状态 |

---

## 11. 参考文件

1. `/docs/specs/ui-design-openclaw-manager-v2.md`
2. `/docs/specs/tech-architecture-openclaw-manager-v2.md`
3. `/docs/specs/setup-assistant-dashboard-hardening.md`

