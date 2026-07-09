# agent-stage-execution Specification

## Purpose

TBD - created by archiving change agentic-sdlc-orchestrator. Update Purpose after archive.

## Requirements

### Requirement: Per-stage model policy

Agent stages SHALL select their model per stage. Autonomous file-editing stages (`propose`,
`build`) SHALL use a tool-capable coding agent (Claude Code); cheap reasoning stages
(`review`, commit-message) SHALL be configurable to a local (Ollama) or OpenAI model.

#### Scenario: Build uses the pinned coding agent

- **WHEN** the `build` stage runs
- **THEN** it executes via Claude Code, not a reasoning-only provider

#### Scenario: Review model is swappable

- **WHEN** the review model is configured to a local Ollama model
- **THEN** the `review` stage runs against that model without code changes

### Requirement: Subscription auth without API token

Claude-backed stages SHALL bill to the Claude subscription via the Agent SDK / Claude Code,
requiring no Anthropic API token. The orchestrator SHALL run with `ANTHROPIC_API_KEY` unset
so billing does not silently fall back to API usage.

#### Scenario: API key present is rejected

- **WHEN** the orchestrator starts with `ANTHROPIC_API_KEY` set in its environment
- **THEN** it fails fast with an error instructing the operator to unset it

#### Scenario: Claude stage runs on subscription

- **WHEN** a Claude-backed stage runs with no `ANTHROPIC_API_KEY`
- **THEN** the agent call is served by Claude Code on the subscription

### Requirement: Skill reuse via scoped invocation

Agent stages SHALL invoke existing skills (`/opsx:*`, `/code-review`) through the Agent SDK
rather than reimplementing their logic, each with per-stage `allowedTools` scoping and a
turn/time cap.

#### Scenario: Release stage cannot edit source

- **WHEN** the `release` stage runs with its scoped tools
- **THEN** it may invoke `gh`/release-please but is not permitted to edit source files

#### Scenario: Propose stage cannot push

- **WHEN** the `propose` stage runs
- **THEN** it may write spec artifacts but is not permitted to push to a remote

### Requirement: Artifact-verified success with bounded retry

Each agent stage's success SHALL be verified against deterministic artifacts, not the agent's
self-report. `build` is complete only when every `tasks.md` checkbox is checked AND
`pnpm validate` exits 0. On `validate` failure the orchestrator SHALL feed the failure output
back to `build` and retry up to 3 times, then suspend for a human.

#### Scenario: Build incomplete when tasks unchecked

- **WHEN** the build agent reports done but `tasks.md` still has unchecked boxes
- **THEN** the stage is not marked complete

#### Scenario: Retry budget exhausts to a human gate

- **WHEN** `pnpm validate` fails 3 consecutive times after `build`
- **THEN** the run suspends with the accumulated failure log for human review
