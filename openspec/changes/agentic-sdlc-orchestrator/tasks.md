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

- [ ] 3.1 Add Claude-Code integration (`@mastra/claude` or `ai-sdk-provider-claude-code`); pick per design Open Question
- [ ] 3.2 Fail-fast guard: error if `ANTHROPIC_API_KEY` is set in the orchestrator env
- [ ] 3.3 Implement worktree isolation: one run = one git worktree/branch
- [ ] 3.4 `build` stage invokes `/opsx:apply` via Agent SDK with scoped `allowedTools` + turn/time cap
- [ ] 3.5 Artifact success contract: complete only when all `tasks.md` boxes checked AND `pnpm validate` exits 0
- [ ] 3.6 Bounded build↔validate retry (≤3×, feed failure output back), then suspend with accumulated log
- [ ] 3.7 **Verify:** a trivial change runs build→validate green on subscription (confirm billing lands on subscription, not API); an unchecked-`tasks.md` case is not marked complete

## 4. Remaining agent stages + per-stage models

- [ ] 4.1 `propose` stage → `/opsx:propose` via Claude Code, scoped tools (no push)
- [ ] 4.2 `review` stage → `/code-review` via a swappable model (Ollama/OpenAI), emits verdict JSON parsed deterministically
- [ ] 4.3 `commit/PR` stage → commit-message via cheap/local model; commitlint check + `gh pr create`; success = commitlint passes AND `gh pr view` returns a PR
- [ ] 4.4 Per-stage model config surface (pin build/propose to Claude; review/commit-msg swappable)
- [ ] 4.5 **Verify:** `review` runs against a local Ollama model with no code change; `release` scoped tools cannot edit source

## 5. PR-backed gates

- [ ] 5.1 Merge + release gates open a PR, suspend, and poll `gh pr view --json state` until merged → auto-resume
- [ ] 5.2 Keep run suspended (and polling) while PR is open; suspend indefinitely if PR is closed unmerged
- [ ] 5.3 **Verify:** integration test simulating a merged PR auto-resumes into the next stage

## 6. ADR 0009 pieces

- [x] 6.1 Add `@commitlint/cli` + `config-conventional`; wire Husky `commit-msg` hook
- [x] 6.2 Add `release-please-config.json` + `.release-please-manifest.json` (seed web 0.1.0, mobile 1.0.0, backend baseline 0.0.0)
- [x] 6.3 Add revision note to ADR 0009 (release-please via local CLI, not GitHub Action)
- [x] 6.4 **Verify:** malformed commit rejected by commitlint (exit 1), conventional accepted (exit 0), release-please CLI invokable. Live Release-PR cut needs GITHUB_TOKEN (deferred).
