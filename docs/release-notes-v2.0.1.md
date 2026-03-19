# ClawDesk v2.0.1

## Summary

This patch release fixes a high-impact UX issue where ClawDesk could accumulate many background `cmd.exe` / `conhost.exe` / `node.exe` processes while polling gateway status on Windows.

## Root Cause

- Gateway status checks were triggered by multiple frontend refresh loops without strict single-flight protection.
- `get_gateway_status` runs `openclaw gateway status --json` (Windows wrapper path often `openclaw.cmd`), which can spawn subprocess trees.
- When status checks became slow or blocked, polling intervals could overlap and stack additional child processes.

## Fixes

- Added frontend status request single-flight + short TTL cache in [`src/services/serviceService.ts`](../src/services/serviceService.ts).
- Added in-flight dedupe for gateway URL resolution in [`src/lib/gateway-client.ts`](../src/lib/gateway-client.ts).
- Added polling overlap guard in [`src/hooks/useGatewayControl.ts`](../src/hooks/useGatewayControl.ts).
- Migrated page-level status callers to the shared gateway status service:
  - [`src/pages/SettingsPage.tsx`](../src/pages/SettingsPage.tsx)
  - [`src/pages/SetupPage.tsx`](../src/pages/SetupPage.tsx)
  - [`src/pages/ModelsPage.tsx`](../src/pages/ModelsPage.tsx)
  - [`src/pages/PluginsPage.tsx`](../src/pages/PluginsPage.tsx)
  - [`src/pages/SkillsPage.tsx`](../src/pages/SkillsPage.tsx)
- Added backend single-flight + cache for gateway status command and reduced status command timeout in [`src-tauri/src/services/gateway_service.rs`](../src-tauri/src/services/gateway_service.rs).
- Updated lint ignores to exclude manual artifacts from CI lint in [`eslint.config.js`](../eslint.config.js).

## Validation

- `npm run lint` ✅
- `npx tsc --noEmit` ✅
- `npm run test:unit` ✅
- `cargo test --manifest-path src-tauri/Cargo.toml` ✅
- Manual Phase 6 smoke:
  - [`docs/testing/phase6-manual-a.md`](../docs/testing/phase6-manual-a.md) ✅
  - [`docs/testing/phase6-manual-b.md`](../docs/testing/phase6-manual-b.md) ✅

## Artifacts

- Windows NSIS: `src-tauri/target/release/bundle/nsis/ClawDesk_2.0.1_x64-setup.exe` (3,599,401 bytes)
- Windows MSI: `src-tauri/target/release/bundle/msi/ClawDesk_2.0.1_x64_en-US.msi` (5,210,112 bytes)
- macOS / Linux bundles are produced by the release workflow matrix (`.github/workflows/release.yml`) on tag `v2.0.1`.
