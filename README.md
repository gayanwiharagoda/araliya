# araliya

Repo `araliya` hosts the **DomusOS** project; all packages use the `@domus/*` scope.

A Turborepo + pnpm monorepo:

- `apps/web` — Next.js 16 (App Router, React 19)
- `apps/mobile` — Expo 56 (expo-router, React Native 0.85)
- `packages/backend` — Convex (shared backend: schema, queries, mutations)
- `tooling/sdlc` — `@domus/sdlc`, the agentic SDLC orchestrator

See [AGENTS.md](AGENTS.md) for the working guidelines and [docs/](docs/) for the
feature pipeline, ADRs, and AI setup.

```sh
pnpm install
pnpm validate   # typecheck → lint → format → tests
```
