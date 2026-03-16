# ClawDesk SPEC: Overview / Install / Diagnostics Hardening

## Background

ClawDesk is a local desktop console for OpenClaw. The current MVP already covers install, config, service control, logs, and settings, but three paths still need to be hardened so first-run users can self-serve:

1. `OverviewPage` should show real aggregated health instead of three isolated cards.
2. `InstallPage` should expose install phases and classify failure reasons.
3. `LogsPage` should export a richer diagnostics package, not only a single text summary.

This SPEC defines the desired behavior and the acceptance criteria for the next implementation batch.

## Goals

### 1. Aggregated Overview

`OverviewPage` must show:

- An overall health headline.
- Real-time health cards for:
  - runtime bridge
  - OpenClaw installation
  - OpenClaw config
  - Gateway service
  - ClawDesk settings
- Recommended next actions derived from the current system state.

### 2. Install Flow Phases

`InstallPage` must show a phase-based setup timeline:

- prerequisite check
- CLI installation
- Gateway managed install
- verification

Each phase must show:

- status: `success | warning | failure | pending`
- detail
- suggestion
- optional error code

The page must classify common failure cases:

- npm missing
- permission denied
- network / npm install failure
- Gateway managed install partial failure

### 3. Diagnostics Export

`LogsPage` must support two export modes:

- text summary export
- ZIP diagnostics bundle export

The ZIP bundle must include:

- generated diagnostics summary text
- install log
- startup log
- gateway log snapshot
- backend environment snapshot
- backend settings snapshot
- backend gateway status snapshot
- sanitized OpenClaw config snapshot

## Non-goals

- Replacing OpenClaw CLI behavior.
- Building a custom chat UI.
- Implementing advanced install rollback.
- Implementing cloud sync.

## Data Contracts

### Overview

Frontend `OverviewStatus` should expose:

- app metadata
- `overall` health block
- five typed section cards
- ordered `nextActions`

### Install

Frontend `InstallActionResult` should expose:

- summary status
- current stage
- ordered `phases`
- actionable detail / suggestion / code
- raw backend data when available

### Diagnostics

Frontend `ExportDiagnosticsData` should expose:

- output file path
- export format
- included files list when available

## Acceptance Criteria

### Overview

- When OpenClaw is missing, Overview recommends going to Install first.
- When config is missing or corrupted, Overview recommends Config next.
- When Gateway is installed but not running, Overview recommends Service next.
- When everything is healthy, Overview recommends opening Dashboard or inspecting logs.

### Install

- Successful CLI + Gateway install shows all phases complete.
- Successful CLI install but failed Gateway managed install shows a warning state instead of pretending everything is complete.
- Missing npm is classified as prerequisite failure.
- Permission errors are surfaced with readable Chinese guidance.

### Diagnostics

- Text export still works in preview/browser mode.
- ZIP export uses the Rust backend in Tauri mode.
- ZIP export feedback shows the actual output path.
- Exported config snapshot never includes the raw API key.

## TDD Plan

Add tests before implementation for:

1. `statusService` overview aggregation.
2. `installService` phase classification.
3. diagnostics export helper formatting.
4. E2E smoke for the new install timeline and diagnostics ZIP button.
