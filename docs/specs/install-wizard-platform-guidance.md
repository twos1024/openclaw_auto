# Install Wizard And Platform Guidance

## Goal
- Add a guided install wizard dialog to ClawDesk.
- Add platform-aware guidance for Windows, macOS, and Linux in the installer UI.
- Add a dashboard diagnostics panel that exposes the current embed phase and cross-platform fallback notes.

## Scope
- Install page
- Dashboard page
- Supporting frontend-only model services and tests

## Install Wizard
- Entry points:
  - Install page header button
  - Optional follow-up from setup flow can navigate to Install page and open later
- Steps:
  - environment check
  - install CLI
  - save provider config
  - start gateway
  - open dashboard
- Rules:
  - if npm is missing, wizard stops on environment check
  - if OpenClaw is installed but config/service are incomplete, wizard moves to next unmet dependency
  - wizard CTA should route to the active step target

## Platform Guidance
- Show cards for:
  - Windows
  - macOS
  - Linux
- Current detected platform is highlighted
- Each card includes:
  - install source
  - common path hints
  - platform-specific troubleshooting note

## Dashboard Diagnostics
- Dedicated panel on Dashboard page
- Shows:
  - current embed phase
  - endpoint
  - current recommended next action
  - platform-specific dashboard troubleshooting note

## TDD
- Unit:
  - install wizard chooses the first unmet dependency as active step
  - platform guidance highlights current platform correctly
- E2E:
  - install page opens install wizard dialog
  - wizard shows detected platform guidance
  - dashboard page shows diagnostics panel with embed phase
