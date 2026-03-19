# ClawDesk v2.0.3

## Summary

This patch finalizes the v2 process-fanout fix release by correcting the GitHub release workflow action version and shipping stable cross-platform packaging.

## Included Fixes

- All `v2.0.2` runtime/process fixes are included.
- Release workflow hotfix in [`.github/workflows/release.yml`](../.github/workflows/release.yml):
  - use `tauri-apps/tauri-action@v0` (resolvable tag)
  - keep explicit `projectPath: .`
  - keep per-platform artifact upload patterns

## Validation

- `npm run lint` ✅
- `npm run test:unit` ✅
- `cargo test --manifest-path src-tauri/Cargo.toml` ✅
- `npm run tauri:build` (Windows local) ✅

## Release

- Version bumped to `2.0.3`.
- Workflow trigger tag: `v2.0.3`.
