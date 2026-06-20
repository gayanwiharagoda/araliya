# 0006. Vitest for test-driven development

- Status: Accepted
- Date: 2026-06-24
- Deciders: DomusOS team

## Context

DomusOS follows test-driven development. The testing framework must support fast feedback loops (watch mode), TypeScript without transpilation config, and ESM modules natively.

## Decision

Use Vitest 4 as the test runner across all workspaces. `vitest.workspace.ts` at the root orchestrates monorepo-wide test runs. `@testing-library/react` for web component tests.

## Consequences

- Native ESM and TypeScript support — no babel/ts-jest config.
- Watch mode (`vitest`) provides instant TDD feedback.
- Compatible with Jest's API (`describe`, `it`, `expect`) — low learning curve.
- `jsdom` environment for web, `node` for backend and mobile logic.
- Vitest workspace config enables `pnpm turbo test` across all packages.
- Smaller ecosystem than Jest, though growing rapidly.

## Alternatives considered

- **Jest**: Industry standard but ESM support is experimental, TypeScript requires ts-jest or babel, and configuration is heavier. Watch mode is slower.
- **Testing Library only (no runner)**: Not a test runner — needs Jest or Vitest underneath.
- **Playwright (for unit tests)**: Designed for E2E, not unit/integration testing. Would add later for E2E.
