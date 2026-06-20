# 0002. Monorepo with Turborepo and pnpm

- Status: Accepted
- Date: 2026-06-24
- Deciders: DomusOS team

## Context

DomusOS has a web app, mobile app, and shared backend. These need to share code (Convex functions, types) while being independently buildable and testable.

## Decision

Use Turborepo for task orchestration and pnpm workspaces for dependency management. Three workspaces: `apps/web`, `apps/mobile`, `packages/backend`.

## Consequences

- Shared code via workspace protocol (`workspace:*`), no publishing needed.
- Turborepo caches build/test/lint results — fast incremental runs.
- pnpm's content-addressable store saves disk vs npm/yarn.
- `.npmrc` requires `node-linker=hoisted` for Metro (React Native) compatibility.
- Team must learn Turborepo's task pipeline config.

## Alternatives considered

- **Nx**: More powerful (dep graph, generators, affected commands) but heavier setup and more config. Overkill for three workspaces.
- **Plain pnpm workspaces**: No task orchestration, no caching, no parallel execution. Would need manual scripts.
- **Separate repos**: Code sharing becomes a versioning/publishing problem. Eliminates atomic changes across web + mobile + backend.
