# 0008. Deterministic validation gates

- Status: Accepted
- Date: 2026-06-24
- Deciders: DomusOS team

## Context

DomusOS is developed with AI agents making code changes. Every change must be machine-verifiable: non-interactive, deterministic, with clear exit codes. Without this, agents cannot self-validate their work.

## Decision

A single `pnpm validate` command runs all quality gates in sequence: typecheck, lint, format check, and tests. All gates are non-interactive and return exit code 0 on success.

Pre-commit hooks (Husky + lint-staged) enforce formatting and linting on every commit.

## Consequences

- Agents run one command after every change — clear pass/fail signal.
- Humans get the same guarantees via pre-commit hooks.
- Sequential execution (typecheck → lint → format → test) fails fast on the cheapest check.
- Adding new gates (e.g., E2E tests) requires updating the validate script.
- Slower than running individual checks, but correctness over speed for validation.

## Alternatives considered

- **CI-only validation**: Agents would not get feedback until push. Too slow for the TDD loop.
- **Individual scripts without orchestration**: No single source of truth for "is this change valid." Agents might skip checks.
- **Watch-mode validation**: Non-deterministic (depends on timing). Not suitable for programmatic pass/fail.
