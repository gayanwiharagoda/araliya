# @domus/sdlc — agentic SDLC orchestrator

A local, deterministic conductor that drives a feature through the whole SDLC:
**propose → build → validate → review → commit/PR → release → archive**, with 3 human
gates. Agent stages are thin wrappers over your existing `/opsx:*` skills, billed to your
Claude **subscription** (no API key). Design: [ADR 0010](../../docs/adr/0010-agentic-sdlc-orchestrator.md).

## Prerequisites

- **Node ≥ 20.19** (the repo's husky hooks and Vitest 4 require it — Node 18 breaks them).
- **`claude` CLI logged in** to your Pro/Max subscription.
- **`ANTHROPIC_API_KEY` unset** — the orchestrator hard-fails if it's set, so agent runs
  can't silently drift onto API billing.
- `gh` authenticated (only needed for the live commit/PR + release stages).

## Try it first with a dry run (no tokens, no side effects)

`SDLC_DRY_RUN=1` skips every subprocess/agent/model call — it exercises only the control
plane (ordering, gates, suspend/resume), so it's safe and instant:

```sh
export SDLC_DRY_RUN=1
pnpm sdlc "demo-feature"                 # → prints a run id, suspends at the plan gate
pnpm sdlc resume <run-id> --approve      # → plan approved, suspends at the merge gate
pnpm sdlc resume <run-id> --approve      # → merge approved, suspends at the release gate
pnpm sdlc resume <run-id> --approve      # → success
pnpm sdlc ls                             # list runs
```

## Running it for real to build a feature

> **Recommended today:** create the change first, then let the orchestrator drive the rest.
> This sidesteps a current rough edge (the CLI takes one kebab-case name, not a free-text
> description — see _Known limitations_).

```sh
# 1. Create the OpenSpec change (interactive — writes proposal/specs/tasks.md)
/opsx:propose add-dark-mode

# 2. Drive the change through the pipeline (real run — unset dry-run!)
unset SDLC_DRY_RUN
pnpm sdlc add-dark-mode
```

What happens:

1. A git **worktree** `.sdlc/worktrees/add-dark-mode` on branch `sdlc/add-dark-mode` is created
   (one run = one change = one worktree).
2. `propose` (skipped if already proposed) → **suspends at the plan gate**.
3. You review the proposal, then `pnpm sdlc resume <run-id> --approve` (or `--reject`).
4. `sync` → `build` (`/opsx:apply` on your subscription) ↔ `validate` (`pnpm validate`),
   retrying up to 3× — build is "done" only when **every tasks.md box is checked AND
   `pnpm validate` exits 0**, never because the agent said so.
5. `review` → `commit/PR` → **suspends at the merge gate** (waiting on the PR).
6. `release` (release-please) → **suspends at the release gate** → `archive`.

## From a GitHub issue

The issue is only the **input context** — its detail seeds `/opsx:propose`, then the
OpenSpec spec drives the rest of the run:

```sh
pnpm sdlc --issue 42
pnpm sdlc --issue https://github.com/gayanwiharagoda/araliya/issues/42   # a link works too
```

1. `gh issue view <n|url>` → the **title** becomes the change name, the **body** becomes the brief.
2. The sync marker `<!-- openspec:<name> -->` is written into issue #42 so `openspec:sync`
   **adopts** #42 as the tracking issue (its checklist follows `tasks.md`) instead of creating
   a duplicate.
3. `propose` runs `/opsx:propose <name>` with the issue body as context; from there the spec
   is the source of truth and the pipeline proceeds as usual.

> Needs `gh` authenticated. The title-derived name is passed explicitly to `/opsx:propose`, so
> the created change matches the marker; if you rename the change, re-point the marker.

## The 3 gates

| Gate        | When                  | How to proceed                                                          |
| ----------- | --------------------- | ----------------------------------------------------------------------- |
| **plan**    | after `propose`       | `pnpm sdlc resume <id> --approve` / `--reject`                          |
| **merge**   | the feature PR        | approve/reject via CLI (auto-resume-on-merge is Group 5, not yet built) |
| **release** | the release-please PR | approve/reject via CLI                                                  |

## Interactive runs (`-i`)

`-i` / `--interactive` drives the whole run in **one terminal**: at each gate it prints a
summary — what's been done, and what to verify — and asks `y/N` right there, then continues.
No second `resume` command, no new terminal.

```sh
pnpm sdlc add-dark-mode -i
```

```
── plan-gate ──
  change:  add-dark-mode
  done:    propose
  verify:  Review the proposal, specs, and tasks.md before the build starts.
  approve & continue? [y/N]
```

`y` continues to the next stage; `N` rejects (the run fails). Answers can be piped for
scripted runs (`printf 'y\ny\ny\n' | pnpm sdlc feat -i`). Without `-i` the run suspends and
you resume with a separate command (below) — better for detached/CI use.

## Unattended runs (`--auto`)

By default a run stops at each of the 3 gates for a human. `--auto` skips gates:

```sh
pnpm sdlc add-dark-mode --auto      # full: propose → … → release → archive, no stops
pnpm sdlc add-dark-mode --auto=pr   # unattended up to the PR, then stop at the merge gate
pnpm sdlc --issue 42 --auto         # works with issue-driven runs too
```

- `--auto=pr` auto-clears the **plan** gate and runs through **commit/PR**, then suspends at
  the **merge** gate so a human reviews and merges the PR on GitHub.
- `--auto` (full) auto-clears **all** gates through `archive`. It fires `release-please` and
  `archive` unattended and creates — but never merges — the feature PR (merge stays a GitHub
  action). Since nothing pauses, ensure `claude` and (for `release`) `GITHUB_TOKEN` /
  `SDLC_REPO_URL` are set first.
- In `--auto`/`--auto=pr`, if `validate` still fails after the 3-attempt budget the run
  **fails** (no human to escalate to) instead of suspending.

## Per-stage agents & models

Each agentic stage runs as a subagent defined in [`.agents/agents/`](../../.agents/agents/)
(discovered via the `.claude/agents` symlink). The agent file is the single place that pins
the stage's **model** (frontmatter) and its **tool scope** — right-sized per job:

| Agent       | Stage     | Model  | Drives          |
| ----------- | --------- | ------ | --------------- |
| `proposer`  | propose   | opus   | `/opsx:propose` |
| `builder`   | build     | opus   | `/opsx:apply`   |
| `reviewer`  | review    | sonnet | judges the diff |
| `committer` | commit-pr | haiku  | commit subject  |

The cheap reasoning stages (`review`, `commit-pr`) are still swappable via `SDLC_MODEL_<STAGE>`,
which overrides the agent's frontmatter model:

```sh
SDLC_MODEL_REVIEW=ollama/llama3        pnpm sdlc add-dark-mode   # local, no key
SDLC_MODEL_COMMIT_PR=openai/gpt-4o-mini pnpm sdlc add-dark-mode   # needs OPENAI_API_KEY
```

Provider prefixes: `claude` (subscription CLI), `ollama/*` (local HTTP, no key),
`openai/*` (needs `OPENAI_API_KEY` — a different vendor).

## Logging

One leveled logger (Mastra's, pino-backed — no extra dependency) carries the stage banners,
the agent's live feed, and the workflow engine's own internals in one timestamped stream.
Set the verbosity with `SDLC_LOG_LEVEL` (`debug`/`info`/`warn`/`error`/`none`, default `info`);
`debug` also surfaces the raw `claude` stream-json events behind the pretty feed.

```sh
SDLC_LOG_LEVEL=debug pnpm sdlc add-dark-mode   # raw agent events + engine detail
```

## Environment variables

| Var                             | Purpose                                                               | Default         |
| ------------------------------- | --------------------------------------------------------------------- | --------------- |
| `SDLC_DRY_RUN`                  | `1` = skip all real execution (control-plane only)                    | off             |
| `SDLC_DB`                       | LibSQL run-state file                                                 | `.sdlc/runs.db` |
| `SDLC_LOG_LEVEL`                | `debug`/`info`/`warn`/`error`/`none` — `debug` shows raw agent events | `info`          |
| `SDLC_MODEL_<STAGE>`            | per-stage model override (`REVIEW`, `COMMIT_PR`)                      | `claude`        |
| `OPENAI_API_KEY`                | required only for `openai/*` models                                   | —               |
| `GITHUB_TOKEN`, `SDLC_REPO_URL` | required only for the live release stage                              | —               |
| `ANTHROPIC_API_KEY`             | **must be unset** (fail-fast guard)                                   | —               |

## Known limitations (work in progress)

- **Change name must be kebab-case.** The CLI's argument becomes the change name and the
  git branch/worktree; free-text with spaces will break a live run. Pass a name like
  `add-dark-mode`, or pre-create with `/opsx:propose` (recommended).
- **Merge/release gates are manual** (approve via CLI). Auto-resume by polling `gh pr view`
  until merged is **Group 5**, not yet implemented.
- **Live `gh`/release-please** need `GITHUB_TOKEN`; those stages are wired and exit-code-gated
  but haven't been run end-to-end against GitHub yet.
