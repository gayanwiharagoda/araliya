# 0007. TypeScript strict mode

- Status: Accepted
- Date: 2026-06-24
- Deciders: DomusOS team

## Context

DomusOS is an agentic codebase where AI agents make code changes. Type errors must be caught at compile time, not runtime, to provide deterministic validation gates.

## Decision

Use TypeScript 6 with `strict: true` and `noUncheckedIndexedAccess: true` across all workspaces. Shared config in `tsconfig.base.json`.

## Consequences

- Strict null checks prevent `undefined is not a function` class of bugs.
- `noUncheckedIndexedAccess` catches array/object index access without null checks.
- Agents get immediate feedback via `pnpm turbo typecheck` — no runtime errors to debug.
- More verbose code in some cases (explicit type narrowing, null checks).
- Third-party libraries with weak types may need `@ts-expect-error` escapes.

## Alternatives considered

- **TypeScript without strict**: Fewer type annotations needed but misses entire categories of bugs. Defeats the purpose of deterministic validation.
- **JavaScript with JSDoc types**: Weaker guarantees, no compile-time enforcement, poor IDE support compared to TypeScript.
