## Context

Per ADR 0010. The feature pipeline already has spec/task/board/gate layers; missing is a
deterministic local conductor. Constraints (from the design interview): deterministic control
plane around non-deterministic agents; local execution, **no GitHub Actions**; Claude
**subscription**, no new API token; per-stage model choice; reuse existing skills. Full tool
research and the resolved auth/model tensions are recorded in ADR 0010.

## Goals / Non-Goals

**Goals:**

- One command (`pnpm sdlc "<desc>"`) drives propose → … → archive with 3 human gates.
- Deterministic, replayable control plane provable with zero token spend (walking skeleton).
- Claude stages on subscription; cheap stages swappable to local/OpenAI.
- Reuse `/opsx:*` and `/code-review`; the conductor only sequences + verifies.

**Non-Goals:**

- Whole-pipeline Claude-free execution; deploy stage; durable/distributed backend
  (Temporal/Inngest/Convex); GitHub Actions.

## Decisions

- **Engine: Mastra, control-flow-first.** Use Mastra's workflow DSL + `suspend/resume` as the
  conductor. _Why over a thin hand-rolled orchestrator:_ model-agnostic routing + durable
  suspend/resume are exactly what Mastra provides; hand-rolling them is net more code once
  multi-provider is required. _Why over Temporal/Inngest:_ overkill for a local, on-demand
  run. Thin orchestrator stays the documented fallback (ADR 0010).

- **State: LibSQL local file**, gitignored (e.g. `.sdlc/runs.db`). Zero infra, deterministic
  replay. _Why:_ laziest durable-local option; Mastra's default adapter.

- **Auth: Claude via subscription through Claude Code**, not Mastra's `anthropic/*` path
  (which uses `ANTHROPIC_API_KEY` → API billing). Use `@mastra/claude` /
  `ai-sdk-provider-claude-code`. Fail fast if `ANTHROPIC_API_KEY` is set. OpenAI/local go
  through Mastra's native model layer (OpenAI needs its own key; local via Ollama needs none).

- **Success contract: artifacts, not self-report.** Each stage exposes a deterministic check
  (`tasks.md` checkoff + `pnpm validate` exit code, `gh pr` state, git tag). Branch decisions
  read the check, never the agent message. This is what makes replay deterministic.

- **Gates: 3, two PR-backed.** Plan gate resumes via CLI/playground. Merge + release gates
  open a PR, suspend, and **poll `gh pr view` until merged** → auto-resume (honors "no
  Actions"; review stays in GitHub, the PR source of truth).

- **Isolation: one run = one change = one git worktree.** Enables safe concurrent runs.

- **Location: new private workspace `tooling/sdlc`.** Imports no app code, imported by
  nothing — enforced by an ArchUnitTS rule, matching existing import-boundary invariants.

- **Reuse via Agent SDK with scoped tools.** Stages call `/opsx:*` / `/code-review` with
  per-stage `allowedTools` (propose: no push; release: `gh`, no source edits) and turn/time
  caps.

- **release-please via local CLI** (ADR 0009 revision), replacing the GitHub Action; same
  Release-PR → tags → CHANGELOG semantics.

- **Build order: deterministic skeleton first.** Prove suspend/resume/replay with no-op
  stages (no tokens) before wiring any agent. See tasks.md.

## Risks / Trade-offs

- **`claude -p`/OAuth billing regressions** (historic issue #43333) → verify the first run
  lands on subscription; keep `ANTHROPIC_API_KEY` unset check as a hard gate.
- **Model capability asymmetry** (only claude-code has built-in agentic tools) → restrict
  swappable models to non-editing stages; do not route `build` to a reasoning-only provider.
- **Skill invocation drift** (a stage can't tell when a skill finished / partial work) →
  never trust completion signals; gate on artifacts (`tasks.md` + `validate`) exclusively.
- **`gh` polling latency / rate limits** → bounded poll interval; suspend indefinitely if the
  PR is closed unmerged.
- **Mastra as a new heavy dep** → confined to `tooling/sdlc`; thin-orchestrator fallback
  documented if it proves unwieldy.
- **Agent retry loops burning subscription budget** → hard cap ≤3× on the build↔validate
  loop, then suspend.

## Migration Plan

Additive — no runtime code in `apps/*`/`packages/backend` changes. Ship behind the new
`tooling/sdlc` workspace + `pnpm sdlc` script. Rollback = remove the workspace/script; the
existing manual `/opsx:*` flow is unaffected. ADR 0009's commitlint hook + release-please
config land in the final task step and are independently reversible.

## Open Questions

- Exact Mastra Claude integration surface: `@mastra/claude` `ClaudeSDKAgent` vs the
  `ai-sdk-provider-claude-code` provider — pick during step 3 (first agent stage) based on
  which cleanly supports per-stage `allowedTools`.
- `gh` poll cadence and max-suspend duration for PR gates — tune during step 5.
