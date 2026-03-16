# Embedded Dashboard And Setup Assistant

## Goal
- Add an embedded OpenClaw Dashboard workspace inside ClawDesk.
- Add a guided setup dialog that helps users move through install, config, service, and dashboard steps.
- Keep OpenClaw UI ownership intact: ClawDesk embeds and orchestrates, but does not reimplement the chat/dashboard product surface.

## Scope
- New `Dashboard` route in the main app shell.
- Embedded dashboard iframe when Gateway is running and a local address is available.
- Global `Setup Assistant` dialog accessible from the app shell.
- Dialog uses existing overview health data to derive step order and current action.

## Non-Goals
- No self-built chat UI.
- No backend websocket/event channel.
- No remote dashboard hosting or auth flow redesign.

## Product Rules
- Dashboard integration priority:
  1. Embedded local dashboard
  2. External open fallback
  3. Guided remediation when service is unavailable
- Guided setup priority:
  1. Install
  2. Config
  3. Service
  4. Dashboard
- If an earlier step is not healthy, later steps must be `blocked`, not `complete`.

## Setup Assistant Model
- Step statuses:
  - `complete`
  - `current`
  - `blocked`
  - `ready`
- Rules:
  - Install unhealthy => install `current`, later `blocked`
  - Config unhealthy with install healthy => install `complete`, config `current`, later `blocked`
  - Service unhealthy with install/config healthy => service `current`, dashboard `blocked`
  - Service healthy => dashboard `ready`

## Dashboard UX
- Header shows runtime state, endpoint, and quick actions.
- If Gateway is running:
  - render iframe titled `OpenClaw Dashboard`
  - allow refresh/restart/open external
- If Gateway is not running:
  - show recovery state instead of blank iframe
  - offer `Start Gateway`
  - offer `Open Setup Assistant`

## App Shell UX
- Add a top bar with:
  - page title area
  - `Setup Assistant` button
- Add `Dashboard` item to sidebar navigation.

## TDD
- Unit:
  - guided setup model blocks downstream steps correctly
  - guided setup model marks dashboard `ready` only when service is healthy
- E2E:
  - `/dashboard` shows embedded iframe for running gateway
  - `Setup Assistant` opens from shell and can route user to the current recommended page

## Acceptance
- User can open a first-class Dashboard page inside ClawDesk.
- User can open a setup dialog from anywhere in the shell.
- The setup dialog never shows contradictory step states.
