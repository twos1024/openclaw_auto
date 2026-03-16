# Dashboard Hardening And Launch Check

## Goal
- Add visible error states for embedded Dashboard failures:
  - load timeout
  - iframe policy / X-Frame-Options style blocking
  - generic loading state
- Add `Launch Check` inside Setup Assistant so users can see immediate install/config/service health before navigating away.
- Prepare the app for `0.1.2` patch release.

## Scope
- Dashboard page and embedded iframe container.
- Setup Assistant dialog.
- Version metadata and release pipeline inputs for `0.1.2`.

## Dashboard Error-State Rules
- `loading`
  - show while iframe is booting
  - explain that local dashboard availability depends on Gateway reachability
- `timeout`
  - trigger when iframe does not reach load-ready state within timeout window
  - show recovery actions: reload iframe, open external, open setup assistant
- `blocked`
  - infer when iframe load completes but inspection still shows `about:blank`
  - explain that iframe policy or X-Frame-Options may be preventing embedding
  - show recovery actions: open external, restart gateway, open setup assistant
- `loaded`
  - show iframe normally

## Launch Check
- Dialog must show a dedicated panel above the guided steps:
  - Install Check
  - Config Check
  - Service Check
- Data comes from the latest overview snapshot already used by Setup Assistant.
- `Refresh` becomes `Run Launch Check`.
- Launch Check is diagnostic; guided steps still control recommended next action order.

## TDD
- Unit:
  - blocked state when iframe inspection ends at `about:blank`
  - loaded state when frame inspection is cross-origin and inaccessible
  - setup assistant model includes launch check rows with current overview levels
- E2E:
  - Setup Assistant shows `Launch Check`
  - Dashboard page surfaces timeout state when embed never becomes ready

## Release
- Bump app/package/Rust/Tauri metadata to `0.1.2`
- Keep CI and release workflows reproducible with existing `npm ci`
