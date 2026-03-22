# Changelog

All notable changes to ClawDesk (OpenClaw Manager) will be documented in this file.

## [3.1.0] — 2026-03-22

### Fixed

- **Windows Gateway startup OOM**: Removed the forced `NODE_OPTIONS=--max-old-space-size=256` cap from desktop-spawned OpenClaw commands so `gateway status/install/start` no longer crash under the latest CLI.
- **Gateway startup false positives**: `start_gateway` and `restart_gateway` now verify the service reaches a real running state instead of trusting the CLI action exit code alone.
- **Missing local Gateway defaults**: Saving or repairing config now backfills `gateway.mode=local` and `gateway.bind=loopback`, which aligns the desktop flow with current OpenClaw doctor expectations.

### Changed

- **Install wizard sequencing**: The install step now stops at CLI installation and clearly defers managed Gateway service setup to the later Gateway step, after API configuration is saved.
- **Service diagnostics and guidance**: Overview, Setup, and Service pages now distinguish between "Gateway service missing" and "Gateway not running", and the primary action switches to install-and-start when the managed service is absent.
- **Release metadata**: Synced package, Tauri, Cargo, and frontend app-version constants to `3.1.0`.

## [3.0.0] — 2026-03-22

### Added

- **Host bridge compatibility helpers**: Reintroduced `hostClient` runtime detection helpers so desktop-host shells can be diagnosed separately from plain browser preview mode.
- **Dashboard URL normalization coverage**: Added focused unit coverage for dashboard URL normalization and host bridge detection fallbacks.

### Fixed

- **Release metadata drift**: Synced package, Tauri, Cargo, and frontend app-version constants to `3.0.0`.

## [2.7.0] — 2026-03-22

### Fixed

- **Windows memory exhaustion on gateway startup**: Spawning multiple `openclaw.cmd` processes on Windows each started a full `node.exe` instance consuming up to 1.4 GB heap. Fixed by capping spawned Node.js heap at 256 MB via `NODE_OPTIONS=--max-old-space-size=256` on all `run_command` invocations.
- **Orphan `node.exe` processes after app close**: On Windows, `kill_on_drop` only terminated the direct child (`cmd.exe`) while grandchildren (`node.exe`) survived. Added a PID registry (`ACTIVE_CHILD_PIDS`) that tracks all spawned processes and kills their full process trees via `kill_all_active_children()` on the `WindowEvent::Destroyed` event.
- **Redundant status polling in SettingsPage**: `GatewayCard` previously registered its own independent 5-second `setInterval` in addition to the shared `useGatewayControl` hook, doubling the number of status-check processes. Refactored to delegate entirely to the shared hook.
- **Repeated PATH filesystem I/O**: `normalized_path_env()` was re-scanning the filesystem on every `run_command` call. Added a `OnceLock`-backed cache (`NORMALIZED_PATH_ENV`) on Windows so the path is resolved once per process lifetime.

### Changed

- **Status cache TTLs increased**: `DETECT_ENV_CACHE_TTL_MS` raised from 2 s → 30 s; `GATEWAY_STATUS_CACHE_TTL_MS` raised from 2 s → 5 s (Rust and TypeScript); reduces IPC chatter and process spawning frequency.

## [2.6.0] — 2026-03-22

### Refactored

- **Inline styles → Tailwind CSS**: Replaced all inline `style={{}}` in `HomeEntryPage`, `NoticeBanner`, and `PageHero` with Tailwind utility classes, enabling consistent dark mode support via `dark:` variants.
- **HomeEntryPage component cleanup**: Replaced raw `<button>` elements with the shared `Button` component; reduced code from 116 → 70 lines.
- **Service layer extraction**: Split `configService.ts` (453 → 240 lines) and `installService.ts` (470 → 90 lines) into I/O orchestration + pure logic modules:
  - `configParser.ts` — config parsing pure functions (`toFiniteNumber`, `toConfigPayload`, `fromUnknownConfig`)
  - `installPhases.ts` — install phase timeline building (`createBasePhases`, `updatePhase`, `toFailureResult`, `toSuccessResult`)
  - `installIssues.ts` — install issue normalization (`normalizeInstallIssue`, `buildIssueFromShellOutput`, `classifyErrorStage`)
- Backward compatibility maintained via re-exports; no downstream import changes required.

### Fixed

- **Version drift**: Synced `constants.ts` APP_VERSION with `package.json` (was stuck at `2.0.4`).

### Improved

- **Dark mode**: All refactored components now support `dark:` Tailwind variants with proper contrast ratios for all 4 notice tones (info/warning/error/success).
- **Testability**: Extracted pure functions can be unit-tested independently without mocking Tauri IPC or shell commands.

### Documentation

- Updated `README.md` with detailed directory annotations, new page descriptions, service layer architecture, and test statistics (22 files, 97 cases).
- Updated architecture breakdown, TDD spec, completion plan, and refactor plan to reflect v2.6.0 state.

## [2.5.0] — 2026-03

### Added

- Agent domain as sole business entry point (`agent_service.rs`); removed `instance_service.rs`.
- Full i18n coverage (zh/en/ja) across all 20 pages (60 translation files).
- Channels, Providers, Cron pages with route and store skeletons.
- Setup wizard persistent state (`setupComplete`).

### Removed

- `instance_service.rs` legacy compatibility layer.
- All `Instance` / `APIMart` terminology from codebase.

## [2.0.0] — 2026-02

### Added

- Tauri v2 + React + Vite desktop application.
- Agent management (create/update/start/stop/delete via IPC).
- Gateway HTTP/SSE dual-channel communication.
- Light/dark/system theme support.
- Hash-based routing with sidebar navigation.
