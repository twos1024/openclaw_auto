# OpenClaw Manager v2.0.0

## Highlights

- Completed architecture refactor aligned with ClawX-inspired v2 docs and phase plan.
- Introduced domain-first stores and routes for `agents / channels / providers / cron / models / setup`.
- Added Rust-side IPC command sets for `channel`, `provider`, and `cron` with frontend fallback integration.
- Completed multi-namespace i18n rollout (zh/en/ja) across all active user-facing pages and major shared components.
- Finalized v2 desktop packaging outputs (MSI + NSIS).

## Key Changes

### Frontend

- New/updated domain services:
  - `src/services/channelService.ts`
  - `src/services/providerService.ts`
  - `src/services/cronService.ts`
- Store split and setup flow improvements:
  - `useAgentStore`, `useChannelStore`, `useProviderStore`, `useCronStore`, `useSettingsStore`, etc.
  - Setup route guards and setup wizard routing.
- i18n namespaces expanded and wired in `src/i18n/index.ts`:
  - `common`, `navigation`, `settings`, `chat`, `skills`, `models`, `feedback`
  - `agents`, `channels`, `providers`, `cron`, `setup`
  - `install`, `config`, `service`, `logs`
  - `overview`, `dashboard`, `runbook`, `plugins`

### Rust / Tauri

- Added gateway API proxy service and domain services:
  - `src-tauri/src/services/gateway_api_service.rs`
  - `src-tauri/src/services/channel_service.rs`
  - `src-tauri/src/services/provider_service.rs`
  - `src-tauri/src/services/cron_service.rs`
- Added IPC command handlers:
  - `src-tauri/src/commands/channel.rs`
  - `src-tauri/src/commands/provider.rs`
  - `src-tauri/src/commands/cron.rs`
- Registered new commands in `src-tauri/src/main.rs` and module exports.

### Testing

- Added domain-service fallback integration tests:
  - `tests/integration/domainServiceFallback.test.ts`
- Updated/maintained existing unit and integration coverage for setup/runbook/install/service/status flows.

## Validation Summary

- `npm run lint` ✅
- `npx tsc --noEmit` ✅
- `npm run test:unit` ✅ (80/80)
- `npm run build` ✅
- `cargo check` ✅
- `cargo test` ✅ (31/31)
- `npm run tauri:build` ✅

## Artifacts

- NSIS: `src-tauri/target/release/bundle/nsis/ClawDesk_2.0.0_x64-setup.exe` (3,578,061 bytes)
- MSI: `src-tauri/target/release/bundle/msi/ClawDesk_2.0.0_x64_en-US.msi` (5,181,440 bytes)

## Notes

- The Phase 6 “no APIMart references” check now passes (`rg -n "apimart|APIMart|api\\.apimart\\.io" src src-tauri` returns no matches).
