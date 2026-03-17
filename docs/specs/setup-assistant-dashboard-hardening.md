## Summary

This slice hardens the guided setup handoff and the embedded dashboard diagnostics.

Goals:
- Setup Assistant must be able to hand users directly into the Install Wizard context.
- Dashboard diagnostics must show actionable checks instead of only static prose.
- Dashboard diagnostics must use a backend probe so desktop runs are not affected by browser CORS rules.

## Scope

In scope:
- `Setup Assistant -> Install Wizard` deep link contract
- Install page auto-opening the wizard from route state
- Dashboard endpoint probe command
- Dashboard diagnostics model and UI
- External dashboard open feedback in the diagnostics panel

Out of scope:
- Rebuilding the OpenClaw dashboard UI
- Streaming dashboard logs into the diagnostics panel
- Changing the published `v0.1.2` release tag

## UX Contract

### Setup Assistant

- If install is the current setup step, `Continue Setup` must route to `/install?wizard=1`.
- The install launch check entry must use the same route.
- Visiting `/install?wizard=1` must open `InstallWizardDialog` immediately.
- Closing the wizard must clear the `wizard=1` query parameter.

### Dashboard Diagnostics

The diagnostics panel must show:
- Embed phase
- Gateway status summary
- Local endpoint probe result
- External open result
- Platform-specific troubleshooting note

Probe states:
- `reachable`
- `timeout`
- `unreachable`
- `invalid-address`
- `idle`
- `probing`

Expected behavior:
- If gateway is not running, probe stays `idle`.
- If probe succeeds, panel shows HTTP status and response time.
- If probe times out, panel shows a timeout-specific message.
- If the embed phase is `blocked`, panel explicitly points users to iframe/security policy checks.
- After `Open External`, panel shows the latest success/failure result from that action.

## Backend Contract

New command:
- `probe_dashboard_endpoint`

Input:
- `address: string`

Output data:
- `address`
- `reachable`
- `result`
- `httpStatus`
- `responseTimeMs`
- `detail`

Behavior:
- Network failures return `success=true` with `reachable=false` and a structured `result`.
- Only invalid input should return a command error.

## Validation

Unit:
- Setup Assistant route switches to `/install?wizard=1` when install is current.
- Install page wizard query behavior is covered via browser test.
- Dashboard diagnostics builder maps probe + embed + external-open states correctly.

Integration:
- `serviceService.probeDashboardEndpoint()` normalizes backend probe data.

E2E:
- `Continue Setup` opens the install wizard when install is incomplete.
- Dashboard page renders probe diagnostics for a running gateway.
