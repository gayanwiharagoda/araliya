## Why

The feature pipeline already runs the front half of an agentic SDLC (OpenSpec `/opsx:*` +
board sync + `pnpm validate`), but every stage is run by hand. We need a **deterministic
local conductor** that chains plan → build → validate → review → release → archive into one
loop with defined human gates. Decided in ADR 0010.

## What Changes

- New private workspace `tooling/sdlc`: a **Mastra** control-flow workflow + a `pnpm sdlc`
  CLI (`sdlc "<desc>"`, `sdlc resume <id>`, `sdlc ls`).
- 8-stage graph — propose → sync → build → validate → review → commit/PR → release →
  archive — with **3 human gates** (approve plan, approve merge PR, approve release PR).
- **Durable local run state** in LibSQL (gitignored); suspend/resume/replay.
- **Per-stage model policy**: `propose`/`build` pinned to Claude Code on the **subscription**
  (no API token, via `@mastra/claude` / `ai-sdk-provider-claude-code`); `review`/commit-msg
  swappable to local Ollama or OpenAI.
- **"Agents propose, deterministic checks dispose"**: stage success verified against
  artifacts (`tasks.md` checkoff + `pnpm validate` exit 0, `gh pr` state, git tags), never
  the model's self-report.
- Isolation: one run = one OpenSpec change = one git worktree. PR gates suspend and **poll
  `gh` until merged**, then auto-resume.
- Reuse existing `/opsx:*` and `/code-review` skills via the Agent SDK with scoped per-stage
  `allowedTools` — no reimplementing agent logic.
- Arch-test rule isolating `tooling/sdlc` (imports no app code; imported by nothing).
- Revises **ADR 0009**: `release` stage runs the **release-please CLI locally** instead of a
  GitHub Action (same semantics: Release-PR → tags → CHANGELOG).

## Capabilities

### New Capabilities

- `sdlc-orchestration`: the deterministic control plane — stage graph, human gates, run
  lifecycle (start/suspend/resume/replay), LibSQL state, worktree isolation, PR-gate polling,
  and the `pnpm sdlc` CLI.
- `agent-stage-execution`: how agent stages run — per-stage model routing, Claude
  subscription auth (no API token), skill invocation via the Agent SDK with scoped tools, and
  the artifact-verification success contract with bounded retry.

### Modified Capabilities

<!-- None — openspec/specs/ is empty; no existing requirement-level specs change. The ADR
     0009 revision is a docs change, not a spec change. -->

## Impact

- **New deps**: `mastra`, `@mastra/*`, `@anthropic-ai/claude-agent-sdk`,
  `ai-sdk-provider-claude-code`, LibSQL client. All confined to `tooling/sdlc`.
- **New workspace** `tooling/sdlc` added to `pnpm-workspace.yaml` + a root `pnpm sdlc` script.
- **Env**: `ANTHROPIC_API_KEY` must be unset in the orchestrator env (else subscription
  billing silently falls back to API billing).
- **External tools shelled out**: `git`, `gh`, `pnpm`, `claude`, `openspec`, `release-please`.
- **Docs**: ADR 0009 gains a revision note; ADR 0010 referenced.
- No changes to `apps/*` or `packages/backend` runtime code.

## Non-goals

- **Not** running the whole pipeline Claude-free (whole-pipeline model swap) — only cheap
  reasoning stages are model-agnostic; agentic file-editing stays on Claude Code.
- **No** GitHub Actions / CI-driven orchestration; the flow is local, on-demand.
- **No** deploy stage yet (no deploy target defined).
- **Not** reimplementing `/opsx:*` or `/code-review` — the orchestrator only sequences and
  verifies.
- **No** durable/distributed backend (Temporal/Inngest/Convex) — deferred; local LibSQL only.
