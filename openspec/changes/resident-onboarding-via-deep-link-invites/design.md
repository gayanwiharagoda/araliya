## Context

Ticket 1 (`foundation-multi-tenant-core-auth-building-setup`) landed the `buildings`, `units`, and `members` tables, committee password auth via Convex Auth, and a web dashboard. The `members` table already has `status` (`invited` | `active`), `role`, `unitId`, and `inviteToken` fields, but no invite generation or claim flow yet.

Residents in Sri Lanka do not receive SMS invites. The committee shares the building's WhatsApp group, so the invite channel is a link pasted into that group. The link must work on a phone without a pre-installed app and must bind the resident to their unit for future payment attribution.

## Goals / Non-Goals

**Goals:**

- Committee admin generates a single-use, optionally expiring invite link for a unit/member.
- Link opens in the mobile app and binds an anonymous Convex Auth session to the member row.
- Claim can happen exactly once; duplicate claims are rejected with a clear error.
- Invalid or expired tokens surface a clear error in the mobile app.

**Non-Goals:**

- SMS or email delivery.
- Push notifications (ticket 6).
- Resident payment screens (tickets 3–4).
- Phone verification or per-resident passwords.
- Committee onboarding via deep link (committee keeps email/password).

## Decisions

### 1. Anonymous Convex Auth provider for residents

- **Choice**: Use `@convex-dev/auth/providers/Anonymous` to create a user account on first link open.
- **Rationale**: No credentials to manage for residents. The link itself is the credential, which matches the v1 security ceiling (private only by WhatsApp group). Anonymous `userId` is stable across sessions.
- **Alternative considered**: Magic-link email — rejected because deliverability/cost in Sri Lanka is uncertain and phone verification is a later upgrade.

### 2. Token stored on the `members` row with claim state

- **Choice**: Add `inviteToken` (already present), `inviteTokenExpiresAt` (optional), `inviteTokenClaimedBy` (optional user id), and `inviteTokenClaimedAt` (optional timestamp) to `members`. Use a single mutation that reads the token row under a unique index and writes the claim atomically.
- **Rationale**: Convex mutations are serialized per document and the unique `by_inviteToken` index guarantees one token per member, so a single mutation is enough for single-use semantics. No separate `inviteTokens` table needed for v1.
- **Alternative considered**: Separate `inviteTokens` table — rejected; adds a join and migration for no added capability in this ticket.

### 3. App scheme + HTTPS fallback for the link

- **Choice**: Shareable format: `domusos://invite?token=<token>` with fallback URL `https://<domain>/invite?token=<token>` that opens the same route.
- **Rationale**: App scheme gives the best UX when the app is installed; HTTPS fallback lets the same link work when shared to users without the app or when opened in a browser. The web route can redirect to the app or store.
- **Trade-off**: The actual public domain and store URLs are not configured yet; v1 uses a placeholder fallback path.

### 4. Deep-link route as a first-class mobile screen

- **Choice**: Add `apps/mobile/app/invite.tsx` handled by `expo-linking`. On mount it parses `token`, calls `signIn("anonymous")`, then calls the `claimInvite` mutation.
- **Rationale**: Keeps the invite logic isolated and testable in one screen. `expo-router` handles scheme registration automatically from `app.json` / `expo-scheme` config.
- **Trade-off**: The user sees a brief loading screen while auth + claim runs.

### 5. Web invite generation UI in building detail

- **Choice**: Add a button next to each unit/member in `Dashboard.tsx` that calls `members.createInvite` and copies the generated link to the clipboard.
- **Rationale**: Reuses the existing dashboard; no new page needed for v1.

## Risks / Trade-offs

- **[Risk] Token forwarded outside the WhatsApp group** → single-use + optional expiry limits blast radius. v1 accepts this ceiling; later phone verification can add per-resident identity if needed.
- **[Risk] Anonymous user loses device/session** → The user can re-open the same invite link before it is claimed to bind again. After claim, the token is burned; account recovery is out of scope for v1.
- **[Risk] App not installed when link opens** → HTTPS fallback shows a page that prompts to install the app. v1 uses a simple placeholder.
- **[Risk] Concurrent duplicate claims** → Convex mutation serialization on the `members` row plus unique `by_inviteToken` index ensures one claim wins and the other sees the claimed state.

## Migration Plan

1. Add anonymous provider to `convex/auth.ts`.
2. Add `inviteTokenExpiresAt`, `inviteTokenClaimedBy`, `inviteTokenClaimedAt` to `members` schema. Convex schema changes are backward-compatible; existing rows have null values.
3. Deploy backend, then web and mobile.
4. No data migration needed; existing members have no token and are unaffected.

## Open Questions

- What is the public HTTPS domain for the fallback URL? (v1 uses a placeholder.)
- Should the token expire? Default expiry window? Proposal: 7 days for v1, configurable later.
- Should the invite be generated per unit or per member? Proposal: per member row (one member per unit resident) so the link already encodes unit attribution.
