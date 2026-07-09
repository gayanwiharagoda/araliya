# Plan: agentic setup + codebase improvements

Executor: any coding agent. Follow the `fable-mode` skill discipline (`.agents/skills/fable-mode/SKILL.md`):
restate each task, plan with checks, verify before claiming done, quote real output.

Audit date: 2026-07-08. Source: full repo assessment (agentic config + code).

## Ground rules for the executor

- One task = one commit, Conventional Commit message (commitlint enforces this).
- After every task: `pnpm validate` must pass. If it fails, fix or revert — never commit red.
- Touch only files the task names. No drive-by refactors (see `.agents/rules/ponytail.md`).
- Tasks marked **[DECISION]** need the human's answer before executing.
- Work top to bottom; tasks are ordered by priority and independence.

---

## Phase 1 — Fix the found problems

### Task 1: Enforce committer agent's "no tools" claim

**Why:** `.agents/agents/committer.md` says "Pure text — no tools, no side effects" but has no
`tools:` frontmatter field. Omitting the field means the agent inherits ALL tools — the
restriction is prose-only, unenforced.

**Files:** `.agents/agents/committer.md`

**Steps:**

1. In the frontmatter, after `model: haiku`, add: `tools: Read`
   (Claude Code has no documented "zero tools" value; `Read` is the least-privilege choice —
   it cannot mutate anything.)
2. Update the description's "no tools" phrase to "read-only, no side effects".

**Verify:** frontmatter parses (a `claude` session lists the agent without error);
`git diff` shows only the two lines changed.

### Task 2: Add project Claude Code settings with push gate + read-only allowlist

**Why:** No `.claude/settings.json` exists. The "agents never push" rule lives only in agent
prose. A committed settings file enforces it at the harness level and reduces permission
prompts for safe read-only commands.

**Files:** create `.claude/settings.json` (the directory exists; it currently holds only
symlinks — a real file alongside them is fine).

**Steps:**

1. Create `.claude/settings.json`:

```json
{
  "permissions": {
    "ask": ["Bash(git push:*)", "Bash(gh pr merge:*)", "Bash(gh release:*)"],
    "allow": [
      "Bash(git status:*)",
      "Bash(git log:*)",
      "Bash(git diff:*)",
      "Bash(git show:*)",
      "Bash(pnpm typecheck:*)",
      "Bash(pnpm lint:*)",
      "Bash(pnpm test:*)",
      "Bash(pnpm validate:*)",
      "Bash(pnpm turbo typecheck:*)",
      "Bash(pnpm turbo lint:*)",
      "Bash(pnpm turbo test:*)",
      "Bash(pnpm format:check:*)"
    ]
  }
}
```

2. Rationale (keep in commit body): pushes/merges/releases always prompt a human — matches
   the SDLC pipeline's human gates. `deny` is NOT used because the commit-pr stage
   legitimately pushes; it must prompt, not be blocked.

**Verify:** `node -e "JSON.parse(require('fs').readFileSync('.claude/settings.json'))"`
exits 0. In a fresh `claude` session, `git status` runs without a permission prompt.

### Task 3: Remove duplicate global find-skills install **[DECISION — outside repo]**

**Why:** `find-skills` exists twice: vendored in-repo (`.agents/skills/find-skills`, hash-pinned
in `skills-lock.json`) and globally (`~/.agents/skills/find-skills`, symlinked from
`~/.claude/skills/find-skills`). Two copies drift; the skill list shows it twice.

**Steps (needs human confirmation — deletes files outside the repo):**

1. `rm ~/.claude/skills/find-skills` (removes the symlink)
2. `rm -rf ~/.agents/skills/find-skills`

**Verify:** a fresh `claude` session in this repo lists `find-skills` exactly once.

### Task 4: Run the openspec-sync tests in validate + CI

**Why:** `scripts/` is not a pnpm workspace, so `turbo test` never runs
`scripts/openspec-sync.test.mjs`. The script `openspec:sync:test` exists but nothing calls it.
The sync tool's tests are currently dead.

**Files:** `package.json` (root)

**Steps:**

1. Change the `validate` script to:
   `"validate": "turbo typecheck lint && prettier --check . && turbo test && pnpm openspec:sync:test"`
   (CI already runs `pnpm validate`, so this covers CI too — no workflow change needed.)

**Verify:** `pnpm validate` passes and its output shows the node test runner executing
`scripts/openspec-sync.test.mjs`.

### Task 5: Add a release-please workflow

**Why:** `release-please-config.json` + `.release-please-manifest.json` exist and ADR 0009
documents automated releases, but no workflow runs it. Releases currently never happen.

**Files:** create `.github/workflows/release-please.yml`

**Steps:**

1. Create the workflow:

```yaml
name: Release Please

on:
  push:
    branches: [main]

permissions:
  contents: write
  pull-requests: write

jobs:
  release-please:
    runs-on: ubuntu-latest
    steps:
      - uses: googleapis/release-please-action@v4
        with:
          config-file: release-please-config.json
          manifest-file: .release-please-manifest.json
```

2. Note in the commit body: requires "Allow GitHub Actions to create and approve pull
   requests" enabled in repo Settings → Actions → General (manual, one-time).

**Verify:** `pnpm exec prettier --check .github/workflows/release-please.yml` passes.
After merge to main, the Actions tab shows the workflow ran and opened a release PR.

### Task 6: Version the SDLC orchestrator with release-please

**Why:** `tooling/sdlc` (`@domus/sdlc`) is the most actively developed package but
release-please tracks only web/mobile/backend — the orchestrator gets no versioning or
changelog.

**Files:** `release-please-config.json`, `.release-please-manifest.json`

**Steps:**

1. Add to `packages` in `release-please-config.json`:
   `"tooling/sdlc": { "release-type": "node", "component": "sdlc" }`
2. Add to `.release-please-manifest.json`: `"tooling/sdlc": "<current version>"` — read
   `<current version>` from `tooling/sdlc/package.json`.
3. Do NOT add `scripts/` — it has no package.json; it versions with the repo root.

**Verify:** both JSON files parse; `pnpm validate` passes.

### Task 7: Web smoke test must test the real app

**Why:** `apps/web/src/__tests__/smoke.test.tsx` renders a throwaway inline `Greeting`
component — zero real app code is covered. `renderWithProviders` in
`apps/web/src/__tests__/test-utils.tsx` (which AGENTS.md points contributors at) is unused.

**Files:** `apps/web/src/__tests__/smoke.test.tsx`

**Steps:**

1. Read `apps/web/src/app/page.tsx` and `apps/web/src/__tests__/test-utils.tsx` first.
2. Replace the inline-component test with one that renders the real `Home` (default export
   of `page.tsx`) via `renderWithProviders`, asserting the `DomusOS` heading renders.
   Delete the `Greeting` component.

**Verify:** `pnpm --filter @domus/web test` passes; the test imports from `../app/page`
and `./test-utils` (grep to confirm).

### Task 8: Give apps/mobile a real test and stop masking emptiness

**Why:** `apps/mobile` has zero tests, but `passWithNoTests: true` in
`apps/mobile/vitest.config.ts` reports green — contradicting the repo's testing policy
("Integration tests: Always"). `apps/mobile/app/index.tsx` calls `useQuery` untested.

**Files:** `apps/mobile/vitest.config.ts`, create `apps/mobile/app/index.test.tsx`

**Steps:**

1. Write `apps/mobile/app/index.test.tsx`: `vi.mock("convex/react", ...)` returning a stub
   `useQuery` with a fixed tasks array; render the default export of `index.tsx`; assert
   the task text appears.
2. React Native components don't render in a node vitest environment out of the box.
   Expected fix: alias `react-native` → `react-native-web` in `vitest.config.ts`, use
   `@testing-library/react`, `environment: "jsdom"`.
   **Fallback if that fights back (>~1h):** extract the testable logic into a plain
   function, test that, and add a `ponytail:` comment in `vitest.config.ts` naming the
   ceiling and upgrade path — do NOT silently leave zero coverage.
3. Once ≥1 test exists, remove `passWithNoTests: true` so future emptiness fails loudly.

**Verify:** the mobile workspace test run (check package name in `apps/mobile/package.json`)
runs ≥1 test and passes; `grep passWithNoTests apps/mobile/vitest.config.ts` returns nothing.

### Task 9: Close the loop on the stalled OpenSpec change **[DECISION]**

**Why:** `openspec/changes/agentic-sdlc-orchestrator/tasks.md` is 26/31 done; the code
shipped through PR #11, but the change was never synced or archived. `openspec/specs/` and
`openspec/changes/archive/` are both empty — the pipeline's "source of truth" layer is
unpopulated.

**Steps:**

1. Ask the human: the 5 unchecked tasks (3.7, 4.5, 5.1–5.3 — live GitHub verification and
   PR-gate polling) — complete now, or descope?
   **If descope:** annotate each in `tasks.md` with a one-line reason under a "Deferred"
   section; they map to the existing `ponytail:` debt at `tooling/sdlc/src/stages.ts:112`.
2. Run `/opsx:sync` (skill `openspec-sync-specs`) to populate `openspec/specs/`.
3. Run `/opsx:archive` (skill `openspec-archive-change`) to archive the change.
4. Run `pnpm openspec:sync` to flip the GitHub issue/board to Done.

**Verify:** `openspec/specs/` non-empty; the change moved under `openspec/changes/archive/`;
the GitHub issue shows Done/closed.

### Task 10: Refresh AI docs

**Why:** `docs/ai-setup/ai-skill-list.md` lists 4 skill families but 8+ are installed.
AGENTS.md's Tech Stack omits `tooling/sdlc` — the largest real codebase in the repo.

**Files:** `docs/ai-setup/ai-skill-list.md`, `AGENTS.md`

**Steps:**

1. Regenerate the skill list from `ls .agents/skills/` — one line per skill: name, one-line
   purpose (from its SKILL.md description), source (external if in `skills-lock.json`,
   else local).
2. In AGENTS.md Tech Stack, add:
   `- tooling/sdlc — @domus/sdlc, the agentic SDLC orchestrator (see tooling/sdlc/README.md)`

**Verify:** every directory in `.agents/skills/` appears exactly once in the doc;
`pnpm format:check` passes.

### Task 11: Naming drift — document, don't rename **[DECISION]**

**Why:** repo/dir is `araliya`; packages are `@domus/*`, root pkg `domus-os`, product
"DomusOS". Internally consistent, but confusing to newcomers.

**Recommendation:** no mass-rename. Add one sentence to the repo README (create root
README.md if absent): "Repo `araliya` hosts the DomusOS project; all packages use the
`@domus/*` scope." Renaming the GitHub repo is the human's call; if done, update
`docs/feature-pipeline.md` and `scripts/.openspec-sync.json`.

**Verify:** README sentence present; `pnpm validate` passes.

---

## Phase 2 — Versioning & governance for agents and skills

The gap: `.agents/**` defines what AI is allowed to do in this repo, but nothing versions or
polices it. External skills are hash-pinned in `skills-lock.json`; local skills, agents, and
rules have no version, no integrity check, no required review. A silent edit to an agent's
`tools:` line or a skill's `description:` changes AI behavior repo-wide with zero oversight.

### Task 12: Semver every local skill and agent

**Why:** git tracks file history, but consumers (humans and the sync/lint tooling) need an
at-a-glance signal of "did behavior change". A `version:` field makes behavior changes
explicit and reviewable.

**Files:** every local (non-vendored) `.agents/skills/*/SKILL.md` and all four
`.agents/agents/*.md`.

**Steps:**

1. Local skills = every dir in `.agents/skills/` NOT listed in `skills-lock.json`
   (currently: all `ponytail-*`, all `openspec-*`, `grill-me`, `testing-strategy`,
   `fable-mode`). Add `version: 1.0.0` to each SKILL.md frontmatter.
   Do NOT touch vendored skills — they are pinned by hash; editing breaks the pin.
2. Add `version: 1.0.0` to the frontmatter of `proposer.md`, `builder.md`, `reviewer.md`,
   `committer.md`.
3. Bump rules (add as a short section to `docs/ai-setup/ai-skill-list.md`):
   - **major** — workflow/output contract changes (a consumer of the skill must adapt)
   - **minor** — `description:` changes (alters triggering), new capabilities, `tools:` or
     `model:` changes on agents
   - **patch** — wording, typos, clarifications with same behavior

**Verify:** Task 13's lint script passes (it checks the field exists).

### Task 13: Agents/skills lint — make governance mechanical

**Why:** rules that aren't checked decay. One dependency-free script enforces the whole
policy on every `pnpm validate` and CI run.

**Files:** create `scripts/agents-lint.mjs`, edit root `package.json`.

**Steps:**

1. Write `scripts/agents-lint.mjs` (plain node, no deps — parse frontmatter with a regex
   between the `---` fences). Checks, each printing a clear failure line:
   - every `.agents/agents/*.md` has `name`, `description`, `model`, **explicit `tools`**,
     and `version` in frontmatter (catches the Task 1 class of bug forever);
   - every `.agents/skills/*/SKILL.md` has `name` + `description`; local ones also `version`;
   - skill `name` matches its directory name; no duplicate names;
   - every entry in `skills-lock.json` has a matching skill directory, and the directory's
     content hash matches `computedHash` (replicate the hash the installer uses — read one
     lock entry, hash the vendored dir, confirm the algorithm before writing the check;
     if the algorithm can't be determined, check existence + warn on hash and add a
     `ponytail:` comment naming that ceiling);
   - exit 1 on any failure, 0 otherwise.
2. Add script: `"agents:lint": "node scripts/agents-lint.mjs"`.
3. Append to `validate`: `... && pnpm agents:lint`.
4. Write `scripts/agents-lint.test.mjs` (node --test, same pattern as
   `scripts/openspec-sync.test.mjs`) covering: passes on current repo; fails on a fixture
   agent missing `tools`; fails on duplicate skill name. Task 4 already wires
   `scripts/*.test.mjs` into validate, so the tests run automatically.

**Verify:** `pnpm agents:lint` exits 0 on the repo; temporarily delete `tools:` from an
agent file → exits 1 with a message naming the file → restore it. `pnpm validate` green.

### Task 14: Required review for agent-config changes

**Why:** changing `.agents/**`, `.claude/settings.json`, or `skills-lock.json` is a policy
change (what AI may do), not a code change. It should never merge without a human looking
at exactly those lines.

**Files:** create `.github/CODEOWNERS`.

**Steps:**

1. Create `.github/CODEOWNERS`:

```
/.agents/           @gayanwiharagoda
/.claude/           @gayanwiharagoda
/skills-lock.json   @gayanwiharagoda
/AGENTS.md          @gayanwiharagoda
/CLAUDE.md          @gayanwiharagoda
```

2. Manual (human, one-time): GitHub Settings → Branches → protect `main`: require PR,
   require CI green, require code-owner review. Note this in the commit body.

**Verify:** file exists; after branch protection is enabled, a test PR touching
`.agents/` shows "Code owner review required".

### Governance rules (adopt; documented via Task 10's doc refresh)

1. **Least privilege, declared:** every agent declares `model` + `tools` explicitly.
   "Never push"-style promises count only when backed by a tool restriction or a
   `.claude/settings.json` gate. (Enforced by Task 13.)
2. **Vendored skills are immutable:** never hand-edit a skill listed in `skills-lock.json`.
   Update = re-install from source + re-pin hash, reviewed as a PR. (Drift caught by Task 13.)
3. **Description = behavior:** a skill's `description:` controls triggering. Changing it is
   a minor version bump and needs the same review as changing the skill body.
4. **New skills/agents arrive by PR** with a version, and — for skills meant to be load-bearing —
   an eval run (the `skill-creator` skill's eval loop) attached to the PR description.
5. **Provenance:** external skills enter only via the installer that writes
   `skills-lock.json`; nothing lands in `.agents/skills/` untracked.

---

## Completion checklist

- [ ] Task 1 — committer tools frontmatter
- [ ] Task 2 — .claude/settings.json gates
- [ ] Task 3 — dedupe find-skills (human confirmed)
- [ ] Task 4 — openspec-sync tests in validate
- [ ] Task 5 — release-please workflow
- [ ] Task 6 — sdlc in release-please
- [ ] Task 7 — web smoke test → real app
- [ ] Task 8 — mobile test + drop passWithNoTests
- [ ] Task 9 — sync + archive OpenSpec change (human decided)
- [ ] Task 10 — refresh AI docs (+ bump rules section)
- [ ] Task 11 — naming README note (human decided)
- [ ] Task 12 — semver on local skills + agents
- [ ] Task 13 — scripts/agents-lint.mjs in validate
- [ ] Task 14 — CODEOWNERS + branch protection (manual part noted)
- [ ] Final: `pnpm validate` green, `pnpm test:e2e` green, CI green on the PR
