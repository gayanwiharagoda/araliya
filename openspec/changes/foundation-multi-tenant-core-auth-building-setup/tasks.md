## 1. Backend schema + auth setup

- [x] 1.1 Add `@convex-dev/auth` to `packages/backend`; add `auth.config.ts` and `http.ts`; document env (`SITE_URL`, JWT keys) in `.env.example`
- [x] 1.2 Replace `convex/schema.ts`: define `buildings` (name, address, region, currency, providerConfig?, createdAt), `units` (buildingId, label, floorArea?), `members` (buildingId, userId?, unitId?, role union, status, inviteToken?) with indexes `by_building`, `by_user`, `by_inviteToken`; add money=integer-LKR-cents comment
- [x] 1.3 Create `convex/auth.ts`: wire Password provider; export a `getUserId(ctx)` helper that throws when unauthenticated
- [x] 1.4 Run `npx convex dev` (from `packages/backend`) to regenerate `_generated` types; verify typecheck sees new tables
- [x] 1.5 Delete `convex/tasks.ts`, `convex/__tests__/tasks.test.ts`, and the tasks integration example test

## 2. Authorization guard (the invariant)

- [x] 2.1 Implement `requireRole(ctx, buildingId, allowed)`: resolve user id → find active membership via `by_user` → assert role ∈ allowed → return membership; throw unauthenticated/forbidden as appropriate
- [x] 2.2 Unit test the role/branch matrix: admin, treasurer, resident, non-member, unauthenticated → allowed vs thrown

## 3. Domain CRUD (all guarded)

- [x] 3.1 `buildings.ts`: `create` (insert building + bootstrap creator as admin/active member), `get` (guarded, any member), `listMine` (via `by_user`)
- [x] 3.2 `units.ts`: `add` (admin only), `list` (any member, building-scoped)
- [x] 3.3 `members.ts`: `add` committee member (admin only), `list` (any member, building-scoped)
- [x] 3.4 Confirm every query/mutation calls `requireRole` as its first authorization step

## 4. Backend integration tests

- [x] 4.1 convex-test: create building → add units → add members; assert rows scoped to the building
- [x] 4.2 convex-test negative: a user with no membership in building X cannot read or mutate anything in X

## 5. Web dashboard shell

- [x] 5.1 Swap `ConvexClientProvider` for `ConvexAuthNextjsProvider`; add sign up / sign in UI using `useAuthActions()`
- [x] 5.2 Replace `page.tsx` with an auth gate: unauthenticated → auth UI; authenticated → dashboard
- [x] 5.3 Dashboard: create building + list-mine, add unit + list units, list members
- [x] 5.4 Integration test (renderWithProviders) for the auth gate / dashboard render

## 6. Mobile shell

- [x] 6.1 Replace `app/index.tsx` with an "enter via invite" landing screen (remove tasks demo); keep Convex client wired in `_layout.tsx`

## 7. Validate

- [x] 7.1 `pnpm validate` green (typecheck → lint → format → test)
- [x] 7.2 E2E (Playwright, web): sign up → create building → see it listed
