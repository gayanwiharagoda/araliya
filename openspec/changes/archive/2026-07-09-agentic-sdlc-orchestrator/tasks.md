## 1. Walking skeleton (deterministic control plane, zero tokens)

- [x] 1.1 Create `tooling/sdlc` workspace (package.json private, tsconfig extends base); add to `pnpm-workspace.yaml` and a root `pnpm sdlc` script
- [x] 1.2 Add deps: `mastra`, `@mastra/*` core, LibSQL client; configure LibSQL storage at gitignored `.sdlc/runs.db`
- [x] 1.3 Define the 8-stage Mastra workflow with all stages as deterministic no-op pass-throughs; encode order + the `validate→build` loop edge
- [x] 1.4 Wire the 3 human gates as `suspend()` points (plan, merge, release)
- [x] 1.5 Build the `pnpm sdlc` CLI: `"<desc>"` (start), `resume <id> [--approve|--reject]`, `ls`
- [x] 1.6 Add ArchUnitTS rule: `tooling/sdlc` imports no app code and is imported by nothing
- [x] 1.7 **Verify:** integration test drives start → suspend at plan gate → resume → complete through all no-op stages, and a resume-after-restart replay reaches the same terminal state

## 2. Deterministic stages (no models)

- [x] 2.1 `sync` stage → shells `pnpm openspec:sync`; gate on exit code
- [x] 2.2 `validate` stage → shells `pnpm validate`; expose pass/fail as the branch signal
- [x] 2.3 `release` stage → shells the **release-please CLI** locally (not a GitHub Action)
- [x] 2.4 `archive` stage → shells `openspec archive <change> -y` + `pnpm openspec:sync`
- [x] 2.5 **Verify:** exit-code gating proven (`runGated` passes on exit 0, throws on non-zero); dry-run e2e proves ordering. Live release-please needs GITHUB_TOKEN (deferred).

## 3. First agent stage — build (Claude subscription)

- [x] 3.1 Claude-Code integration via thin `runSkill` (`claude -p`, subscription); chose subprocess over `@mastra/claude`/provider — no new deps, no API key
- [x] 3.2 Fail-fast guard: `assertNoApiKey()` errors if `ANTHROPIC_API_KEY` is set (checked on run start + inside `runSkill`)
- [x] 3.3 Worktree isolation: `createWorktree` — one run = one worktree/branch under gitignored `.sdlc/`
- [x] 3.4 `build` stage invokes `/opsx:apply` via `runSkill` with scoped `allowedTools`/`disallowedTools` (no push) + `maxTurns`
- [x] 3.5 Artifact success contract: `allTasksChecked` (tasks.md) AND `pnpm validate` exit 0 drive the branch signal — never the agent's self-report
- [x] 3.6 Bounded build↔validate retry (≤3×), then `build-result` suspends for a human with the failure context
- [ ] 3.7 **Verify (LIVE — needs your subscription):** run a trivial change build→validate green, confirm billing lands on subscription not API. (Hermetic parts done: unchecked-`tasks.md` → not complete; API-key guard; arg construction; worktree; dry-run e2e.)

## 4. Remaining agent stages + per-stage models

- [x] 4.1 `propose` stage → `/opsx:propose` via `runSkill` (Claude-pinned), scoped tools (no push)
- [x] 4.2 `review` stage → swappable model (`runModel`, `SDLC_MODEL_REVIEW`), emits verdict JSON parsed deterministically (unparseable → stage fails). Uses a reasoning prompt, not the Claude-only `/code-review` skill, so it can run on Ollama/OpenAI.
- [x] 4.3 `commit/PR` stage → commit-message via swappable model; commitlint check + `git commit` + `gh pr create`; success = commitlint passes AND `gh pr view` returns a PR (live `gh` deferred)
- [x] 4.4 Per-stage model config surface: `stageModel()` reads `SDLC_MODEL_<STAGE>` (build/propose pinned to Claude; review/commit-pr swappable to `ollama/*`/`openai/*`)
- [ ] 4.5 **Verify (LIVE — needs Ollama):** `review` against a local Ollama model. (Hermetic done: model routing/override/parse, dry-run short-circuit, openai-key guard; `release` is a deterministic shellStage with no agent tools, so it inherently cannot edit source.)

## 5. PR-backed gates

- [ ] 5.1 Merge + release gates open a PR, suspend, and poll `gh pr view --json state` until merged → auto-resume
- [ ] 5.2 Keep run suspended (and polling) while PR is open; suspend indefinitely if PR is closed unmerged
- [ ] 5.3 **Verify:** integration test simulating a merged PR auto-resumes into the next stage

## 6. ADR 0009 pieces

- [x] 6.1 Add `@commitlint/cli` + `config-conventional`; wire Husky `commit-msg` hook
- [x] 6.2 Add `release-please-config.json` + `.release-please-manifest.json` (seed web 0.1.0, mobile 1.0.0, backend baseline 0.0.0)
- [x] 6.3 Add revision note to ADR 0009 (release-please via local CLI, not GitHub Action)
- [x] 6.4 **Verify:** malformed commit rejected by commitlint (exit 1), conventional accepted (exit 0), release-please CLI invokable. Live Release-PR cut needs GITHUB_TOKEN (deferred).

## Deferred (descoped at archive, 2026-07-09)

These 5 tasks were intentionally descoped when this change was archived. They need live
external runs or an as-yet-unbuilt feature, and are tracked as the `ponytail:` debt at
`tooling/sdlc/src/stages.ts:112` (auto-resume-on-merge, Group 5).

- **3.7** — LIVE build→validate on a real Claude subscription (needs the user's account + billing check).
- **4.5** — LIVE `review` against a local Ollama model (needs Ollama running).
- **5.1–5.3** — PR-backed merge/release auto-resume-on-merge; not yet implemented, so the merge and release gates stay manual for now.
