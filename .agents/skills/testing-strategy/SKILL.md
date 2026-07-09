---
name: testing-strategy
description: "Decide what tests to write for a change in this monorepo. Use when adding or changing code, writing tests, or asking what to test. Always write integration tests; unit-test complex logic only."
version: 1.0.0
---

# Testing strategy

The rule for this repo: **every change gets an integration test. Unit tests only for
complex logic.** Do not unit-test what an integration test already covers.

## Decision procedure

For each change, in order:

1. **Integration test — always.** Cover the change at its boundary: the data flow it
   touches, from input to persisted/observable result. Not optional.
2. **Unit test — only if the change contains complex logic.** Complex = auth checks,
   state machines, algorithms, computed/derived values, non-obvious branching. Test that
   unit in isolation, in addition to the integration test.
3. **Skip unit tests** for simple CRUD, trivial getters, pass-through wrappers, plain
   config. The integration test is enough.

If unsure whether logic is "complex": would a bug in it be caught by the integration
test's assertions? If yes, no separate unit test. If the branch is hard to reach through
the boundary, unit-test it.

## Where each test goes

| Change is in… | Integration test | How |
| --- | --- | --- |
| `packages/backend` Convex fn | required | `convex-test` in `convex/__tests__/`. See `convex/__tests__/integration-example.test.ts` |
| `apps/web` component/route | required | `renderWithProviders` from `apps/web/src/__tests__/test-utils.tsx` |
| `apps/mobile` screen/logic | required | render through expo-router context; assert observable output |
| pure function / util | its integration path covers it | add a unit test **only** if it holds complex logic |

Unit tests are colocated: `foo.ts` → `foo.test.ts` in the same directory.

Architecture tests (`tests/arch.test.ts`, ArchUnitTS) and E2E (Playwright, `pnpm test:e2e`)
already exist repo-wide — you rarely add to them per change. Add an E2E only for a new
critical user path in the web app.

## Workflow

1. Write the integration test first (TDD): `pnpm turbo test:watch`.
2. Identify complex logic in the change → add colocated unit tests for those units only.
3. Make them pass.
4. `pnpm validate` before finishing.

## Anti-patterns

- Shipping code with no integration test. Not allowed.
- Unit-testing every function "for coverage" — noise, deleted on review.
- Mocking the boundary the integration test exists to exercise (real `convex-test` DB,
  real providers).
- Re-asserting in a unit test what the integration test already proves.
