# CLAUDE.md

@AGENTS.md
@.agents/rules/planning.md

## Tech Stack

Turborepo + pnpm monorepo with three workspaces:

- `apps/web` — Next.js 16 (App Router, React 19)
- `apps/mobile` — Expo 56 (expo-router, React Native 0.85)
- `packages/backend` — Convex (shared backend: schema, queries, mutations)

TypeScript 6 strict mode. Vitest 4 for tests. ESLint 9 + Prettier + Husky.

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
