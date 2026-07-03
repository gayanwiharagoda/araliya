# 0010. Agentic SDLC orchestrator (Mastra, local, subscription-billed)

- Status: Proposed
- Date: 2026-07-02
- Deciders: DomusOS team

## Context

The feature pipeline already covers the front half of an agentic SDLC: OpenSpec is the
source of truth (`/opsx:propose → apply → sync → archive`), work is mirrored to GitHub
Issues + a Projects v2 board, `pnpm validate` gates quality, and ADR 0009 defines the
release half (Conventional Commits + release-please). What is missing is a **deterministic
conductor** that chains these stages into one end-to-end loop — plan → build → validate →
review → release → archive — with defined human gates, rather than each stage being run by
hand.

Forces shaping the choice:

- **Determinism is required.** The control plane (which stage runs when, gates, retries,
  branch selection) must be deterministic and replayable. LLM output cannot be made
  deterministic, so the requirement is really: a deterministic control plane wrapping
  non-deterministic agent steps. This mirrors ADR 0008's stance on deterministic gates.
- **Local execution, no GitHub Actions.** The workflow runs on a developer machine, driven
  by a CLI, not by CI/webhooks.
- **Claude subscription, no new API token.** Agent stages must bill to the existing Claude
  Pro/Max subscription (which, as of 2026-06-15, includes an Agent SDK credit covering the
  Agent SDK and `claude -p`). A stray `ANTHROPIC_API_KEY` silently reroutes to API billing,
  so the orchestrator env must keep it unset.
- **Model-agnostic per stage.** Cheap/reasoning stages (review triage, commit-message,
  changelog) should be swappable to local (Ollama) or OpenAI models; only the autonomous
  file-editing stages need a tool-capable coding agent.
- **Reuse the existing skills.** The conductor sequences and verifies; it must not
  reimplement the `/opsx:*` or `/code-review` agent logic.

## Decision

Build a local, deterministic SDLC orchestrator as a new private workspace (`tooling/sdlc`)
using **Mastra** as the control-flow engine, driven by a `pnpm sdlc` CLI.

1. **Engine — Mastra, control-flow-first.** Use Mastra's workflow DSL
   (`.then/.branch/.parallel/.dowhile`, `suspend/resume`) as the deterministic conductor,
   with **LibSQL** (a local SQLite file, gitignored) for durable run state and replay. The
   `mastra dev` playground is available for watching/tracing runs; the **CLI is the primary
   interface** (`pnpm sdlc "<desc>"`, `pnpm sdlc resume <id>`, `pnpm sdlc ls`).

2. **Stage graph (8 stages, 3 human gates).**

   ```
                          ┌─ gate ─┐        ┌─ gate ─┐      ┌─ gate ─┐
   propose ─→ sync ─→ build ─→ validate ─→ review ─→ commit/PR ─→ release ─→ archive
     │                  ↑         │                                (release-please CLI)
     └─ gate: plan      └─ fail ──┘ (≤3× auto-retry, then suspend)
   ```

   Gates: approve **plan** (after propose), approve **merge** (the feature PR), approve
   **release** (the release-please Release-PR).

3. **Per-stage model policy.** Autonomous file-editing stages (`propose`, `build`) are
   pinned to **Claude Code on subscription** (via `@mastra/claude` / the
   `ai-sdk-provider-claude-code` community provider — no API key). Cheap reasoning stages
   (`review`, commit-message) are swappable to `ollama/*` (local, no token) or `openai/*`
   (opt-in, brings its own key — a different vendor, not double-billing Claude).

4. **Agents propose, deterministic checks dispose.** A step never trusts an agent's
   self-report. Stage success is verified against deterministic artifacts: `build` is "done"
   only when every `tasks.md` box is checked **and** `pnpm validate` exits 0; `commit/PR`
   only when commitlint passes **and** `gh pr view` returns a PR; etc. This is what makes
   replay deterministic — same artifacts, same branch, every time.

5. **Isolation & gates.** One run = one OpenSpec change = one git worktree/branch. The two
   PR-backed gates (merge, release) suspend and **poll `gh pr view` until merged**, then
   auto-resume — review happens in GitHub, honoring "no GitHub Actions" (polling is local,
   no webhooks). The plan gate resumes via CLI/playground.

6. **Reuse.** Agent stages invoke the existing `/opsx:*` and `/code-review` skills through
   the Agent SDK with scoped per-stage `allowedTools` (propose: no push; release: `gh` but
   no source edits) and turn/time caps. Mastra adds sequencing and verification, not new
   agent logic.

**Revision to ADR 0009:** ADR 0009 specifies release-please as a **GitHub Action**. Since
this workflow is local and rejects Actions, the `release` stage instead runs the
**release-please npm CLI** locally. Semantics are unchanged (Release-PR → tags → per-package
`CHANGELOG.md`); only the trigger moves from CI to the local orchestrator.

## Consequences

- One command drives the full lifecycle locally; stages that used to be run by hand are
  chained with defined gates and bounded retries.
- The deterministic control plane is provable independent of any model: the walking skeleton
  (all stages as no-ops) exercises start → suspend → resume → replay with zero token spend.
- Agent stages stay on the Claude subscription; local/OpenAI models are available for cheap
  stages, with real cost/latency savings.
- **New dependency + workspace:** Mastra, `@mastra/claude`, LibSQL, and a `tooling/sdlc`
  package. An arch-test rule keeps it isolated (imports no app code; imported by nothing).
- **Capability asymmetry to design around:** only the claude-code provider ships built-in
  agentic tools; `openai/*` and `ollama/*` are reasoning-only unless tools/MCP are wired, so
  they are used only for non-editing stages.
- **Billing hygiene is load-bearing:** `ANTHROPIC_API_KEY` must be unset in the orchestrator
  env or subscription billing silently falls back to API billing.
- GitHub remains the source of truth for PRs/issues; the local workflow polls it rather than
  owning that state.
- Actual implementation (the workspace, CLI, stage wiring, and ADR 0009's commitlint hook +
  release-please config) is a separate change tracked in OpenSpec once this ADR is accepted.

## Alternatives considered

- **Thin owned TS orchestrator (no framework).** A ~200-line CLI sequencing stages in plain
  TypeScript, calling the Agent SDK and shelling out. Rejected as the primary approach once
  **model-agnosticism** became a requirement: multi-provider routing (subscription Claude +
  OpenAI + local) and durable suspend/resume are exactly what Mastra already provides, so
  hand-rolling them is net more code. Remains the fallback if Mastra proves heavyweight.

- **GitHub Actions as the orchestrator.** The SDLC is GitHub-event-shaped and release-please
  is already an Action. Rejected: the workflow must run **locally**, and Actions would also
  need an API token/OAuth secret rather than the local subscription.

- **Temporal / Inngest / Restate.** Mature durable-execution engines. Rejected as overkill:
  a local, on-demand run (minutes to an hour) does not need distributed workers, multi-day
  replay, or a cluster. Mastra can adopt a Temporal/Inngest backend later if runs ever
  become long-lived or distributed, so this is deferred, not foreclosed.

- **Convex `@convex-dev/workflow`.** Already in the stack and deterministic. Rejected: it is
  documented as not yet production-ready, and the app backend is the wrong home for dev-ops
  orchestration that must shell out to `git`/`gh`/`pnpm`/`claude`.

- **Mastra's native model layer for Claude.** Mastra's `anthropic/*` path uses
  `ANTHROPIC_API_KEY` (API billing). Rejected for the Claude stages in favor of the
  Claude-Code provider so billing stays on the subscription; Mastra's native provider layer
  is still used for the `openai/*` and `ollama/*` stages.
