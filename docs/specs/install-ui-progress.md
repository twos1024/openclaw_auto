# ClawDesk SPEC: Install UI and Progress Feedback

## Background

ClawDesk already supports:

- runtime prerequisite detection through `detect_env`
- OpenClaw CLI installation through `install_openclaw`
- managed Gateway install attempt
- structured install result and issue reporting

The current install page is functionally correct, but the UX is still too coarse:

- loading feedback is only a button label change
- install phases are only visible after the command finishes
- success / warning / failure summaries are readable, but the in-flight experience is weak
- the page mixes environment summary, action controls, and results without a clear hierarchy

This batch upgrades the install experience without changing the backend command contract.

## Goals

### 1. Better install information architecture

The install page should be organized into four clear sections:

1. readiness summary
2. install actions
3. live progress
4. result / next steps

### 2. Deterministic in-flight progress feedback

Because `install_openclaw` is currently a single backend command and does not stream server-side progress, the frontend must not pretend to know exact backend progress.

Instead, ClawDesk should use:

- estimated stage progression
- explicit wording that this is current install activity
- a bounded progress bar that advances while waiting
- final reconciliation from the real backend result

### 3. Stronger interaction feedback

During installation:

- the primary install button must enter loading state
- the refresh button must be disabled
- the page must show a current phase headline and detail
- phase timeline should visibly mark the active step
- the UI must remain readable in success, warning, and failure exits

### 4. Accessibility and operator clarity

The progress surface must include:

- `role="progressbar"`
- bounded numeric progress values
- human-readable current phase text
- warning text when progress is estimated instead of streamed

## Non-goals

- streaming backend progress over Tauri events
- introducing cancellation / pause / resume semantics
- redesigning the whole design system
- changing the existing Rust install command payload

## UX Structure

### Readiness Summary Card

Show:

- npm readiness
- OpenClaw detection
- platform / architecture
- config path

The summary should tell the user whether install can start now.

### Action Card

Show:

- refresh environment button
- primary install button
- secondary logs shortcut
- blocked reason when npm is missing

### Progress Card

Show only when:

- installation is in progress, or
- a result already exists

Contents:

- current phase title
- short phase detail
- progress bar
- progress percentage
- small note that progress is estimated while waiting for command completion

### Timeline

The timeline should always be visible, but while install is running it must reflect:

- completed earlier stages as `success`
- active stage as `running`
- later stages as `pending`

### Result Card

The result card should summarize:

- final install state: success / warning / failure
- main detail
- next recommended action
- executable path if available
- notes if present

## Progress Model

### Phase sequence

Fixed phase order:

1. `prerequisite`
2. `install-cli`
3. `install-gateway`
4. `verify`

### Estimated progress behavior

When install starts and prerequisites are valid:

- prerequisite immediately becomes `success`
- active phase begins at `install-cli`
- progress increases over time but caps below completion while the command is still running
- if the backend eventually returns:
  - `success` or `warning`: progress becomes `100`
  - `failure`: progress settles on the failed stage and no longer animates

### Progress constraints

- idle page progress should not render as active install progress
- estimated in-flight progress must never claim `100` before backend completion
- recommended in-flight cap: `92-96`

## Data Contract

Frontend install state should expose a derived progress model:

- `visible`: whether progress card is shown
- `percent`: `0..100`
- `tone`: `idle | running | success | warning | failure | blocked`
- `activePhaseId`
- `headline`
- `detail`
- `hint`

This model should be derived from:

- environment
- install result
- install in-flight state
- elapsed client time during the running install command

## Acceptance Criteria

### Install in progress

- clicking install shows a progress card immediately
- the active phase is visible without waiting for backend completion
- the progress bar uses `role="progressbar"`
- progress remains below `100` until the backend result resolves

### Install success

- progress becomes `100`
- result card shows success
- phase timeline matches backend result

### Partial success

- progress becomes `100`
- result card shows warning
- Gateway stage remains warning with backend-provided explanation

### Failure

- progress stops on the failed stage
- result card shows failure and suggestion
- failure does not leave the page in loading state

### Prerequisite mismatch

- if npm is missing but OpenClaw CLI is still detectable, downstream preview stages must not render as success

## TDD Plan

Add tests before implementation for:

1. progress model:
   - running install returns bounded estimated progress
   - success result returns `100`
   - failure result uses failed stage and failure tone
2. preview phases:
   - npm missing + OpenClaw present does not mark downstream steps as success
3. E2E loading flow:
   - install page shows progress UI during a delayed install command
   - progress bar is visible before the command resolves

