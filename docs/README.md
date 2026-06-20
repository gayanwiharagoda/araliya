# AI base initialization setup for production ready development

Central index for project documentation. Concise by default — see [AGENTS.md](../AGENTS.md).

## Structure

| Area         | Path                                          | Purpose                                                               |
| ------------ | --------------------------------------------- | --------------------------------------------------------------------- |
| Architecture | [architecture/](architecture/)                | System overview, components, data flow, tech stack.                   |
| ADRs         | [adr/](adr/)                                  | Architecture Decision Records — why each significant choice was made. |
| Specs        | [specs/](specs/)                              | Feature/component specifications, written before/with implementation. |
| Skills       | [ai-skill-list.md](ai-setup/ai-skill-list.md) | Claude Code skills — slash commands for workflows and tooling.        |
| Pipeline     | [feature-pipeline.md](feature-pipeline.md)    | How to run features: OpenSpec → GitHub Issues/Projects board.         |

## Documents

- [Architecture overview](architecture/README.md)
- [ADR index](adr/README.md)
  - [0001 — Record architecture decisions](adr/0001-record-architecture-decisions.md)
  - [0002 — Monorepo with Turborepo and pnpm](adr/0002-monorepo-turborepo-pnpm.md)
  - [0003 — Expo for mobile](adr/0003-expo-for-mobile.md)
  - [0004 — Next.js for web](adr/0004-nextjs-for-web.md)
  - [0005 — Convex as backend and database](adr/0005-convex-backend.md)
  - [0006 — Vitest for test-driven development](adr/0006-vitest-for-tdd.md)
  - [0007 — TypeScript strict mode](adr/0007-typescript-strict-mode.md)
  - [0008 — Deterministic validation gates](adr/0008-deterministic-validation-gates.md)
- [Specs index](specs/README.md)
- [AI Skills list](ai-setup/ai-skill-list.md)
- [Feature pipeline runbook](feature-pipeline.md)

## Conventions

- Update the relevant doc in the same PR as the change. Docs drift = docs lie.
- One ADR per significant decision. Never rewrite a decided ADR — supersede it with a new one.
- One spec per feature/component. Link it from the implementing PR.

## Repo tooling

- Agent guidelines: [AGENTS.md](../AGENTS.md); `CLAUDE.md` imports it via `@AGENTS.md`.
- Skills: `.agents/skills/` (source of truth), symlinked at `.claude/skills`.
- Commands: `.agents/commands/` (source of truth), symlinked at `.claude/commands`. Slash commands; subfolders namespace (e.g. `.agents/commands/opsx/*` → `/opsx:*`).
- Rules: `.agents/rules/` (source of truth), symlinked at `.claude/rules`.
- [ponytail](https://github.com/DietrichGebert/ponytail) — "lazy senior dev" ruleset (`.agents/rules/ponytail.md`, imported by `CLAUDE.md`) + skills under `.agents/skills/ponytail*`. Commands: `/ponytail`, `/ponytail-review`, `/ponytail-audit`, `/ponytail-debt`, `/ponytail-gain`, `/ponytail-help`.
