# ClawDesk SPEC: Install Failure Context / Gateway CLI Hardening

## Background

ClawDesk `0.1.0` already supports:

- detecting the local runtime
- installing OpenClaw through npm
- attempting managed Gateway installation
- reading Gateway status and local logs

The current MVP works, but two places still need to be made more trustworthy:

1. install failures are still explained too generically
2. Gateway CLI JSON parsing should be resilient to more real-world payload shapes

This SPEC defines the next hardening batch.

## Goals

### 1. Structured Install Failure Context

When `install_openclaw` fails or only partially succeeds, ClawDesk should expose structured context so the frontend does not have to guess purely from raw stderr.

The failure context should answer:

- which install stage failed
- which command step failed
- what kind of failure it was
- which error code should be shown
- what the operator should do next
- one representative output sample for diagnosis

### 2. Better Gateway Managed Install Warnings

If CLI install succeeds but `openclaw gateway install --json` fails, ClawDesk should keep the action result in a warning state and surface the Gateway-specific issue in a readable way.

The install page should show:

- warning title
- Gateway install step
- error code when available
- concrete suggestion

### 3. Gateway Status Parsing Compatibility

`get_gateway_status` should tolerate multiple JSON layouts returned by OpenClaw CLI, including:

- top-level fields
- nested `gateway` or `service` objects
- string-based booleans and ports
- alternate URL fields such as `url` or `dashboardUrl`

## Non-goals

- redesigning the whole command contract
- adding a rollback mechanism
- changing the published `0.1.0` release artifacts

## Data Contract

### Install Issue

Frontend and backend should share the same conceptual install issue shape:

- `stage`
- `failureKind`
- `code`
- `message`
- `suggestion`
- `step`
- `exitCode`
- `sample`

This shape can appear:

- in backend error details for failed installs
- in install success payload for partial Gateway-install warnings

## Failure Kinds

The first hardening batch should classify at least:

- `missing-npm`
- `permission-denied`
- `network-failure`
- `command-timeout`
- `gateway-install-failed`
- `unknown`

## Acceptance Criteria

### Install

- npm missing is shown as a prerequisite problem, not a generic install failure
- permission errors point to elevation or writable directories
- npm network failures mention registry / network / proxy checks
- Gateway managed install warnings expose the Gateway step and suggestion

### Gateway

- nested JSON payloads still produce the correct running state, port, URL, PID, and suggestion
- port conflict text still maps to `E_PORT_CONFLICT`

## TDD Plan

Add tests before implementation for:

1. frontend install action classification from structured backend error details
2. frontend Gateway warning rendering from `gatewayInstallIssue`
3. Rust install issue classification helpers
4. Rust Gateway status JSON compatibility helpers
