# Changelog

All notable changes to ClawDesk (OpenClaw Manager) will be documented in this file.

## [3.0.0] — 2026-03-22

### Architecture

- **Host bridge abstraction**: Introduced `src/services/hostClient.ts` as the canonical entry point for all IPC communication with the desktop runtime. All business code (services, hooks, components) now imports from `hostClient` instead of the Tauri-specific `tauriClient`. This decouples the frontend contract from any specific desktop shell technology.
- **Host-agnostic runtime types**: Added `HostRuntimeMode`, `HostBridgeSource`, and `HostDiagnostics` types to `src/types/api.ts`. New mode values (`host-runtime-available`, `host-runtime-unavailable`, `browser-preview`) replace the old Tauri-prefixed names in all business logic.
- **Error code renamed**: `E_TAURI_UNAVAILABLE` → `E_HOST_UNAVAILABLE` across all services, pages, and tests — removes Tauri-specific naming from the public error surface.
- **Compatibility shim**: `tauriClient.ts` retained as a re-export shim for one release cycle, mapping host-agnostic types back to legacy Tauri-named types for backward compatibility. Will be removed in a future release.

### Changed

- **User-visible text**: All error messages, diagnostic labels, and i18n strings that previously said "Tauri command bridge" or "Tauri shell" now use host-neutral language ("host command bridge", "Host Shell", "desktop application").
- **Test infrastructure**: Added `tests/helpers/hostBridgeMock.ts` with `resetHostBridgeGlobals()`, `simulateHostRuntimeAvailable()`, `simulateHostRuntimeUnavailable()`, and `simulateLegacyTauriBridge()` helpers — eliminates per-test `Object.defineProperty` boilerplate across all integration tests.
- **CI**: Added `npm run typecheck` (tsc --noEmit) step to the CI pipeline before unit tests.

### Refactored

- **Dashboard components**: `DashboardFrame` and `DashboardPage` inline styles fully replaced with Tailwind CSS classes.

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
