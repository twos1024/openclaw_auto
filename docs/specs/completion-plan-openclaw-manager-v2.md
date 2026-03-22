# OpenClaw Manager v2.1+ Completion Plan

> 目标：把当前项目从“可用但仍有迁移残留”的状态，收口到一个一致、可测试、可发布的完成态。

## 1. 现状判断

当前仓库已经完成了大部分 v2 迁移：

- 前端已经切到 `agents / channels / providers / cron / setup` 的产品语言。
- `useAgentStore`、`AgentsPage`、`CreateAgentWizard` 已经承担主入口。
- Rust/Tauri 侧已经有 `agent_service` 与对应 IPC 命令。
- 但代码与文档仍然存在迁移中间态：
  - `instance_service` 的旧命名和旧模型仍残留在服务层或历史文档中。
  - 服务层对失败路径、空数据、字段回填的语义还不完全一致。
  - 设计文档里有“instance 已删除”的结论，但实际工作树中仍可能存在兼容/回流实现。

结论：这不是“再补几个按钮”级别的问题，而是一次完成度收口。

## 2. 完成目标

最终状态应满足：

1. Agent 是唯一对外术语。
2. 后端命令失败就返回失败，不再伪装成成功。
3. 创建/更新时采集到的字段必须完整回填到返回对象。
4. 前端只消费一致的数据契约，不处理伪成功对象。
5. 全链路有单测和最小集成验证，避免回归。
6. 文档、命名、路由、store、IPC、Tauri 命令统一收口。

## 3. 推荐架构

### 3.1 领域边界

推荐把 `agent_service` 作为唯一的业务域服务入口：

- Tauri 命令层只做入参/出参封装。
- `agent_service` 负责 Agent 领域语义。
- 如果需要保留 `instance_service`，也只能是临时兼容适配层，不允许再承载独立业务逻辑。

原因：

- 前端已经全面使用 Agent 术语。
- 现有 release notes 与 architecture doc 已经把 `instance_service` 定义为历史层。
- 保持两个等价服务层会继续制造语义漂移，后续 bug 也会更难定位。

### 3.2 数据契约

Agent 数据应统一包含：

- 身份：`id`, `displayName`
- 模型：`modelId`, `modelName`, `modelParams`
- 连接：`channelType`, `apiKeyRef`, `baseUrl`
- 元数据：`status`, `createdAt`, `updatedAt`, `lastActiveAt`

规则：

- `modelParams` 不能丢失。
- `apiKeyRef` / `baseUrl` 不能在服务层被默默清空。
- `id` 必须是 UUID v4 或等价可验证唯一 ID，不允许时间戳拼接式 fallback。

### 3.3 错误模型

推荐统一为：

- shell / CLI 非零退出码 => `Err`
- JSON 解析失败 => `Err`
- 返回体缺字段或形状不对 => `Err`
- 只有真正成功且 payload 合法时才返回 `Ok`

前端只处理两类结果：

- 成功对象
- 结构化错误对象

不要再依赖“空列表表示失败”或“合成成功对象”。

## 4. 需要完成的工作流

### 4.1 Agent 域完成

目标是把 Agent 入口彻底做实。

要做的事：

- 清理 `instance` 残留命名。
- 统一 `agent_service` 作为 Tauri 业务入口。
- 确保 `create / update / start / stop / delete / list` 的失败语义一致。
- 确保前端 `useAgentStore`、`AgentsPage`、`CreateAgentWizard` 与后端契约一致。

验收标准：

- 创建失败不会插入假 Agent。
- 更新失败不会错误覆盖本地卡片。
- 启停失败会保留原状态，并显示错误。

### 4.2 Provider / Channel 闭环

目标是让 Agent 的连接信息不是“只在表单里存在”，而是能被完整保存和验证。

要做的事：

- Provider 创建、编辑、校验。
- Channel 创建、绑定、状态更新。
- `apiKeyRef` 的引用链路闭环。
- `baseUrl` 的保存、展示、编辑闭环。

验收标准：

- 用户能从 UI 完成 provider/channel 的配置与验证。
- Agent 编辑页能够稳定读回 provider/channel 相关字段。

### 4.3 Cron / Setup / Models 收口

目标是把剩余骨架页做成闭环，而不是停留在“能打开页面”。

要做的事：

- Setup wizard 变成可重复执行的状态机。
- Cron 任务可以创建、启停、查看结果。
- Models 页面展示真实 Provider/模型统计，而不是占位文案。

验收标准：

- 新用户能从首次启动走到可用状态。
- 任务/模型页有真实数据而不是假静态。

### 4.4 错误和运行时治理

目标是把“能跑”变成“可诊断、可恢复”。

要做的事：

- 统一 `BackendError` 的 message / suggestion / details 结构。
- 所有关键 IPC 命令带清晰错误码。
- Tauri / browser preview / runtime unavailable 的区分继续保持。

验收标准：

- UI 出错时能给出明确修复建议。
- 同类失败在不同页面上的呈现一致。

## 5. 测试矩阵

### 5.1 Rust / Tauri

必须覆盖：

- 单个 Agent JSON 解析
- 列表解析
- create/update merge 逻辑
- start/stop/delete 错误路径
- UUID 生成或唯一 ID 生成

### 5.2 前端

必须覆盖：

- `useAgentStore` 成功/失败分支
- `AgentsPage` 空状态、错误状态、加载状态
- `CreateAgentWizard` 完成流程、校验、错误展示
- 命令失败后本地状态不被误更新

### 5.3 集成

至少要有：

- IPC 成功/失败 smoke test
- Browser preview 下的 runtime fallback test
- 一个端到端主路径：创建 Agent -> 启动 -> 停止 -> 删除

## 6. 清理项

完成后应清掉：

- 重复/过时的 `instance` 叙述。
- 旧 release notes 与新代码状态不一致的地方。
- 假成功、假空列表、时间戳 ID fallback。
- 没有实际调用点的兼容代码。

**已完成的清理：**

- ✅ 服务层大文件拆分（configService 453→240 行，installService 470→90 行）。
- ✅ 纯逻辑提取为独立模块（configParser, installPhases, installIssues），可独立单测。
- ✅ UI 层内联样式全部替换为 Tailwind 工具类，统一暗色主题支持。
- ✅ HomeEntryPage 复用 Button 组件，消除原生 `<button>` 样式不一致。

## 7. 推荐实施顺序

1. 先收口 Agent 服务层错误语义。
2. 再统一前后端契约，保证字段不丢。
3. 然后补齐 provider/channel 的数据闭环。
4. 接着完成 setup/cron/models 的产品闭环。
5. 最后做文档和测试矩阵清理。

## 8. 结束定义

这个项目可以算“完成”，当且仅当：

- 所有主页面都有真实数据闭环。
- 所有关键命令失败时都能正确报错。
- Agent 配置字段不再在服务层丢失。
- 文档、命名、代码结构一致。
- 通过完整测试矩阵。

