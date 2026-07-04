## Why

DomusOS v1 is a payments + accountability layer for Sri Lankan apartment communities (sits alongside WhatsApp, not a chat replacement). Backend + both apps are stock Convex demo — no auth, no tenancy. This is ticket 1 of 6: it lays the multi-tenant foundation every other ticket (invites, fees, payments, announcements, reminders) builds on. Without it there is no building scoping and no authorization invariant to enforce money later.

## What Changes

- **BREAKING**: replace the `tasks` demo schema/functions with real domain tables (`buildings`, `units`, `members`). Delete `tasks.ts` + its tests and the starter UI in both apps.
- New `buildings` table: name, address, region (`"LK"`), currency (`"LKR"`), providerConfig, createdAt.
- New `units` table: buildingId, label (e.g. `"A-12"`), floorArea (optional — for later by-area apportionment).
- New `members` table: buildingId, userId (nullable while invited), unitId (nullable for committee-only), role, status (`"invited" | "active"`), inviteToken. Indexes: `by_building`, `by_user`, `by_inviteToken`.
- **Auth**: Convex Auth (`@convex-dev/auth`) Password provider — email + password sign up / sign in for committee admins.
- **Central authorization guard** (`convex/auth.ts` or `lib/authz.ts`): `requireRole(ctx, buildingId, allowed[])` resolves caller identity → their membership in that building → asserts `role ∈ allowed`, else throws. Every domain query/mutation goes through it. This is the single most important invariant of the app.
- **CRUD**: buildings (create / get / list-mine), units (add / list), members (add committee member, list). Roles: `admin`, `treasurer`, `resident`.
- **Web dashboard shell** (`apps/web`): auth UI (sign up / sign in), create building, add units, list members. Replaces starter page.
- **Mobile shell** (`apps/mobile`): Convex client wired; lands on an "enter via invite" state (real resident onboarding is ticket 2).
- **Money convention** decided now (not built here): all money stored as **integer minor units (LKR cents)** everywhere.

## Capabilities

### New Capabilities
- `committee-auth`: Convex Auth Password provider — committee admins sign up / sign in with email + password; server helper to resolve the authenticated user id.
- `multi-tenant-core`: buildings / units / members schema, their CRUD functions, and the central `requireRole` membership-and-role guard that scopes every domain operation to one building.
- `web-dashboard-shell`: authenticated web UI to sign up/in, create a building, add units, and list members.
- `mobile-shell`: mobile app wired to Convex, landing on an "enter via invite" placeholder state.

### Modified Capabilities
<!-- None — greenfield; no existing specs in openspec/specs/. -->

## Impact

- `packages/backend/convex/`: `schema.ts` (replace), new `buildings.ts` / `units.ts` / `members.ts` / `auth.ts` (+ authz helper), `auth.config.ts`, `http.ts`; remove `tasks.ts` + tests. New dep: `@convex-dev/auth`.
- `apps/web/src/app/`: replace `page.tsx`, add auth + dashboard routes/components; wire `ConvexAuthProvider`.
- `apps/mobile/app/`: replace `index.tsx` with invite-landing state.
- Tests: integration (convex-test) for the create-building → add-units → add-members flow + negative scoping; unit tests for the `requireRole` role/branch matrix; E2E (Playwright) sign up → create building → see it.

## Non-goals

- Resident invite/onboarding flow (ticket 2), fees/ledger (3), payments (4), announcements (5), reminders (6).
- Any money movement or ledger — only the storage convention (LKR cents) is fixed here.
- Mobile beyond a wired client + invite placeholder (no resident auth on mobile yet).

## Assumptions

- Only committee admins authenticate in this ticket (Password provider); residents arrive via invite in ticket 2, hence nullable `userId`/`inviteToken` on `members`.
- `providerConfig` is a free-form object placeholder for later payment-provider settings (validated as `v.optional(v.any())` for now).
- One user may be a member of multiple buildings; `by_user` index supports list-mine.
