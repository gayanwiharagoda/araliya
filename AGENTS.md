# AGENTS.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Be extremely concise. Sacrifice grammar for the sake of concision.**

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:

- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:

- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

---

Always-apply ruleset: @.agents/rules/ponytail.md

## Tech Stack

Turborepo + pnpm monorepo with three workspaces:

- `apps/web` — Next.js 16 (App Router, React 19)
- `apps/mobile` — Expo 56 (expo-router, React Native 0.85)
- `packages/backend` — Convex (shared backend: schema, queries, mutations)

TypeScript 6 strict mode. Vitest 4 for tests. ESLint 9 + Prettier + Husky.

## Feature pipeline

Each feature is one OpenSpec **change**; OpenSpec is the source of truth. A sync mirrors each
change to one GitHub issue (checklist body = its `tasks.md`, native progress bar) on a unified
cross-repo Projects v2 board. Loop:

```sh
/opsx:propose          # describe a feature → proposal + specs + tasks.md (the "tickets")
/opsx:apply            # AI builds it, checking off tasks.md as it goes
pnpm openspec:sync     # mirror changes → GitHub issues + Project board (idempotent)
/opsx:archive          # when done → sync flips the issue to Done/closed
```

Monitor: **status** = the GitHub Project board (each card shows its repo via the Repository
field + `repo:<name>` label). **Live activity** = run `/opsx:apply` as a background task.

Status mapping: 0 tasks done → Todo · some → In Progress · all done or archived → Done.

Setup, multi-repo onboarding, and troubleshooting: [docs/feature-pipeline.md](docs/feature-pipeline.md).

## Validation

Run after every change:

```sh
pnpm validate          # typecheck → lint → format check → test (fails fast)
```

Individual gates:

```sh
pnpm turbo typecheck   # strict TypeScript
pnpm turbo lint        # ESLint
pnpm format:check      # Prettier
pnpm turbo test        # Vitest
```

## TDD

```sh
pnpm turbo test:watch  # vitest watch mode for red-green-refactor
```

Test files colocated with source: `foo.ts` → `foo.test.ts` (same directory).

## Convex

`packages/backend/convex/_generated/` contains type stubs for local typecheck.
Run `npx convex dev` from `packages/backend/` to generate real types from a deployment.

## Testing Policy

Four test layers. See the `testing-strategy` skill for the per-change decision procedure.

**Integration tests**: Always. Every change gets one, covering the data flow at its boundary.

**Unit tests**: Complex logic only — auth checks, state machines, algorithms, computed values.
Do NOT unit-test simple CRUD, trivial getters, or pass-through functions.

Integration test details:

- Convex functions: use `convex-test` in `packages/backend`. See `convex/__tests__/integration-example.test.ts`.
- Web components with providers: use `renderWithProviders` from `apps/web/src/__tests__/test-utils.tsx`.

**Architecture tests**: Import boundary enforcement via ArchUnitTS in `tests/arch.test.ts`.
Runs with `pnpm turbo test`. Backend must not import from apps. Apps must not import from each other.

**E2E tests**: Critical user paths in the web app via Playwright. Run separately:

```sh
pnpm test:e2e          # Playwright (not part of validate — it's slow)
```
