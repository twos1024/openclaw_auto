# Install Log Driven Progress

## Goal
- Replace purely time-based install phase switching with install-log-driven phase detection.
- Keep percentage progress as an estimate inside a phase, but make the active phase come from real backend stage events whenever available.
- Preserve graceful fallback to the existing elapsed-time model when logs are unavailable.

## Scope
- Rust install service writes explicit phase events into `install.log`.
- Frontend polls `read_logs(source=install)` only while an install is in progress.
- Install progress card and phase timeline consume parsed install telemetry.

## Non-Goals
- No streaming subprocess stdout implementation in this change.
- No websocket or event bus for progress updates.
- No redesign of the service/logs pages outside install progress integration.

## Backend Contract
- `install.log` must include structured phase lines:
  - `[phase] stage=install-cli state=running detail=...`
  - `[phase] stage=install-cli state=success detail=...`
  - `[phase] stage=install-gateway state=running detail=...`
  - `[phase] stage=install-gateway state=success|failure detail=...`
  - `[phase] stage=verify state=running|success|failure detail=...`
- Existing `[stdout]`, `[stderr]`, `[error]` lines stay intact for diagnostics.

## Frontend Behavior
- While `install_openclaw` is pending:
  - poll install logs every `700ms`
  - parse latest structured phase event
  - use parsed phase as the active step in the progress card and timeline
- Progress percentage rules:
  - active phase from log event
  - fill percentage remains estimated inside that phase range
  - never reach `100` until backend install command resolves
- Fallback behavior:
  - if no phase event is present, use existing elapsed-time segmentation
  - if log polling fails, keep the install action running and stay on fallback estimation

## UX
- Progress card hint distinguishes:
  - `实时阶段来自安装日志`
  - `当前为前端估计进度`
- Latest meaningful install log line may be surfaced as supporting detail when useful.
- Timeline must highlight the phase reported by install telemetry.

## Accessibility
- Progress bar keeps `role="progressbar"` and valid `aria-valuenow`.
- Phase change text remains under `aria-live="polite"`.

## TDD
- Unit:
  - parse phase events from install logs
  - latest event wins
  - progress model prefers log telemetry over elapsed-only inference
- E2E:
  - while install is delayed, UI transitions to `安装 Gateway 托管服务` based on mocked install logs before the command resolves

## Acceptance
- During a delayed install, UI can move from `安装 OpenClaw CLI` to `安装 Gateway 托管服务` without waiting for the old elapsed threshold.
- If log polling is unavailable, install flow still works with the previous estimation model.
