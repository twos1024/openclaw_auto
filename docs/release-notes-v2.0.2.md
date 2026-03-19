# ClawDesk v2.0.2

## Summary

This patch release completes the process-fanout mitigation and fixes cross-platform release packaging for macOS and Linux.

## Fixes

- Fixed a Rust cross-platform compile error in [`src-tauri/src/adapters/platform.rs`](../src-tauri/src/adapters/platform.rs) where a Windows-only helper was referenced from common code paths.
- Removed a non-Windows unused variable path in [`src-tauri/src/adapters/shell.rs`](../src-tauri/src/adapters/shell.rs).
- Added short TTL cache + in-flight dedupe for environment detection in [`src-tauri/src/services/env_service.rs`](../src-tauri/src/services/env_service.rs) to avoid repeated shell process bursts.
- Invalidated environment cache after successful CLI install in [`src-tauri/src/services/install_service.rs`](../src-tauri/src/services/install_service.rs).
- Updated release workflow in [`.github/workflows/release.yml`](../.github/workflows/release.yml):
  - `tauri-action` upgraded to `@v1`
  - explicit `projectPath: .`
  - per-platform artifact path upload rules (`.exe`, `.dmg`, `.deb`, `.AppImage`)

## Validation

- `npm run lint` ✅
- `npm run test:unit` ✅
- `cargo test --manifest-path src-tauri/Cargo.toml` ✅
- `npm run tauri:build` (Windows local) ✅

## Release

- Version bumped to `2.0.2` in frontend package, Rust crate, and Tauri config.
- Tag for workflow release: `v2.0.2`.
