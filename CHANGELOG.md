# Changelog

All notable changes to ClawDesk (OpenClaw Manager) will be documented in this file.

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
