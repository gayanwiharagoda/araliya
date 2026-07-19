## Why

Residents in Sri Lanka join without SMS — the committee already coordinates the building on WhatsApp. Sharing a deep-link invite into the existing WhatsApp group avoids SMS cost/deliverability issues and fits the "alongside WhatsApp" strategy. This turns the placeholder `inviteToken` from ticket 1 into a working resident onboarding flow.

## What Changes

- **Invite generation (web)**: committee admins generate a single-use, optionally expiring invite link for a unit/member. Link format: `domus://invite?token=<token>` with an `https://` fallback page that routes to the app or store.
- **Invite redemption (mobile + backend)**: opening the deep link resolves the token, creates a Convex Auth anonymous session, binds that user to the `members` row, sets `status = "active"`, and clears the token so it cannot be reused.
- **Token hygiene**: single-use tokens; optional expiry window; invalid/expired/claimed tokens show a clear in-app error.
- **BREAKING**: `members.add` no longer defaults to `status = "active"` for residents; it stores `status = "invited"` and `inviteToken` when the invite path is used.

## Capabilities

### New Capabilities

- `resident-invite-generation`: committee admins generate and copy a shareable invite link per unit/member from the web dashboard.
- `resident-invite-redemption`: mobile deep-link handler and backend mutation that claim an invite token and bind an anonymous Convex Auth session to the resident's unit.

### Modified Capabilities

- `multi-tenant-core`: extend the `members` lifecycle with `invited` status, `inviteToken` generation, single-use redemption, and expiry. `members.add` behavior changes for resident invites (invited status + token instead of active).

## Impact

- `packages/backend/convex/members.ts`: add `generateInvite` (admin-only, creates invited member with token), `claimInvite` (anonymous/public, binds user, activates, clears token), and `getByToken` query for token lookup.
- `packages/backend/convex/schema.ts`: no table changes required (token/status fields exist); may add `by_inviteToken` optimization if not already present.
- `apps/web/src/`: new UI to select a unit and copy/share the invite link; link includes app scheme + HTTPS fallback.
- `apps/mobile/`: `expo-linking` listener + `expo-router` screen for `/invite`; calls `claimInvite` and routes to a resident home placeholder.
- Tests: convex-test integration for token generation, claim, second-claim rejection, and unknown/expired tokens.

## Non-goals

- Push notifications (ticket 6).
- Resident-side fees, payments, or ledger screens (tickets 3–4).
- Phone number verification or password auth for residents.
- Store/app routing logic beyond a simple HTTPS fallback page.

## Assumptions

- Link privacy is bounded by the WhatsApp group it is shared in; single-use + expiry limits blast radius for v1.
- Anonymous Convex Auth provider is sufficient for resident identity; phone verification can be added later if needed.
- The HTTPS fallback page is served from the existing `apps/web` deployment and simply redirects to the app store or opens the app scheme.
- `members.add` for committee members remains `active` (no token); the invite flow is used for residents joining via link.
