## Context

Backend + both apps are stock Convex demo (`tasks` table, no auth). This ticket (1 of 6) replaces that with the real multi-tenant core and the authorization invariant every later ticket depends on. Constraints: Turborepo/pnpm monorepo, Convex shared backend, TS6 strict, ponytail (minimum code, no unrequested abstraction), import boundaries (backend must not import apps). The guard is the single most important invariant — money features (tickets 3–6) sit on top of it, so it must be correct and centrally enforced, not copy-pasted per function.

## Goals / Non-Goals

**Goals:**
- Tenant schema: `buildings`, `units`, `members` with the three `members` indexes.
- Committee auth via `@convex-dev/auth` Password provider (email + password).
- One reusable guard `requireRole(ctx, buildingId, allowed)` that every domain function calls.
- Minimal CRUD: buildings (create/get/list-mine), units (add/list), members (add/list).
- Web dashboard shell (auth + create building + units + members) replacing the starter page.
- Mobile shell: Convex wired, "enter via invite" landing.

**Non-Goals:**
- Resident invite/onboarding (ticket 2), fees/payments/announcements/reminders (3–6).
- Any money movement — only the LKR-cents storage convention is fixed.
- Mobile committee auth or resident auth.

## Decisions

### D1 — Convex Auth (`@convex-dev/auth`) Password provider
Native Convex auth over rolling our own or adding Clerk/Auth.js. It gives `ctx.auth.getUserIdentity()` server-side and a `users` table, wires cleanly into Convex functions, and keeps identity resolution in the same runtime as the guard. Adds `auth.ts`, `auth.config.ts`, `http.ts` per the library's setup. *Alternative:* Clerk — rejected: extra external service + dashboard for a committee-only email/password flow. *Alternative:* hand-rolled password hashing — rejected: security-sensitive, reinventing stdlib (rung 2).

### D2 — Single `requireRole` guard, returns the membership
`requireRole(ctx, buildingId, allowed: Role[])`: resolve user id (throw if unauthenticated) → query `members` `by_user`, find the active row for `buildingId` (throw forbidden if none) → assert `role ∈ allowed` (throw forbidden) → return the membership. Domain functions call it first and reuse the returned membership. One function, one place to audit. *Alternative:* per-function inline checks — rejected: the invariant would drift and can't be unit-tested once. *Alternative:* separate `requireMember` + `requireRole` — collapse into one; `requireRole(ctx, id, ["admin","treasurer","resident"])` expresses "any member".

### D3 — Lookup path uses `by_user` then filter by building
`members.by_user` returns a user's memberships (few); pick the one matching `buildingId`. Avoids a composite index for the tenant sizes here. `by_building` serves list-members; `by_inviteToken` reserved for ticket 2 (invite redemption) — added now because it's schema, cheap, and named in scope. *Ceiling (ponytail):* linear scan over one user's memberships — fine for a person in a handful of buildings; upgrade to a `by_user_building` composite index if that grows.

### D4 — Create-building bootstraps the first membership
`buildings.create` inserts the building then inserts a `members` row (userId=caller, role `admin`, status `active`, unitId null). Solves the chicken-and-egg: without it the creator couldn't pass their own guard. Done in one mutation (Convex mutations are transactional).

### D5 — Roles as a string union, money as integer LKR cents
`role: v.union(v.literal("admin"), v.literal("treasurer"), v.literal("resident"))`; `status: "invited" | "active"`. No money fields yet, but the convention (integer minor units) is documented in schema comments so tickets 3–6 don't reintroduce floats. `providerConfig: v.optional(v.any())` — a placeholder for later payment-provider settings; validated for real when payments land.

### D6 — Web auth via `ConvexAuthNextjsProvider`; mobile stays unauthenticated
Web swaps `ConvexProvider` for the Convex Auth Next.js provider and uses `useAuthActions()` for sign in/up; a gate component shows auth UI vs dashboard. Mobile keeps its plain `ConvexProvider` and renders a static invite-landing screen — no auth dependency pulled into Expo this ticket.

## Risks / Trade-offs

- **Guard bypass if a domain function forgets to call `requireRole`** → the invariant is worthless. Mitigation: every mutation/query in `buildings.ts`/`units.ts`/`members.ts` calls it as line one; unit-test the role/branch matrix (admin/treasurer/resident/non-member/unauthenticated); integration test asserts cross-tenant reads fail.
- **`@convex-dev/auth` setup drift** (missing `auth.config.ts`/`http.ts`/env) → auth silently fails locally. Mitigation: follow the library quickstart exactly; `.env.example` documents `SITE_URL`/JWT keys; smoke sign-up test.
- **Convex `_generated` stubs vs real deployment** → types may lag until `npx convex dev` runs. Mitigation: generate types once against a dev deployment before typecheck; note in tasks.
- **Nullable `userId`/`inviteToken` now, used in ticket 2** → carrying unused columns. Accepted: they are schema, cheap, and named in this ticket's scope; avoids a migration next ticket.

## Migration Plan

Greenfield data (demo only) — no production data to migrate. Steps: remove `tasks` table/functions/tests and starter UI; add new schema + functions; run `npx convex dev` to regenerate types; wire web/mobile providers. Rollback = revert the branch (no persisted state depends on the old demo).

## Open Questions

- Exact `@convex-dev/auth` version pinned to Convex/Next 16 / React 19 — confirm compatibility at install; fall back to the latest supported combo.
- Whether `members.add` should also accept an existing user's email to link now, or stay committee-only until ticket 2 — default: committee-only (userId set by creator context), revisit in ticket 2.
