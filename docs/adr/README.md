# Architecture Decision Records (ADR)

An ADR captures one significant architectural decision: its context, the choice, and the consequences.

## Process

1. Copy [`0000-template.md`](0000-template.md) to `NNNN-short-title.md` (next free number).
2. Status flow: `Proposed` → `Accepted` (or `Rejected`).
3. Never rewrite an accepted ADR. To change a decision, add a new ADR and mark the old one `Superseded by NNNN`.

## Index

| #                                                        | Title                                    | Status   |
| -------------------------------------------------------- | ---------------------------------------- | -------- |
| [0001](0001-record-architecture-decisions.md)            | Record architecture decisions            | Accepted |
| [0002](0002-monorepo-turborepo-pnpm.md)                  | Monorepo with Turborepo and pnpm         | Accepted |
| [0003](0003-expo-for-mobile.md)                          | Expo for mobile                          | Accepted |
| [0004](0004-nextjs-for-web.md)                           | Next.js for web                          | Accepted |
| [0005](0005-convex-backend.md)                           | Convex as backend and database           | Accepted |
| [0006](0006-vitest-for-tdd.md)                           | Vitest for test-driven development       | Accepted |
| [0007](0007-typescript-strict-mode.md)                   | TypeScript strict mode                   | Accepted |
| [0008](0008-deterministic-validation-gates.md)           | Deterministic validation gates           | Accepted |
| [0009](0009-automated-release-and-commit-conventions.md) | Automated release and commit conventions | Proposed |
| [0010](0010-agentic-sdlc-orchestrator.md)                | Agentic SDLC orchestrator (Mastra)       | Proposed |
