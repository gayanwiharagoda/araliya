## MODIFIED Requirements

### Requirement: Building, unit, and member data model

The system SHALL define three tenant tables. `buildings` has name, address, region, currency, optional providerConfig, and createdAt. `units` has buildingId, label, and optional floorArea. `members` has buildingId, nullable userId, nullable unitId, role, status, nullable inviteToken, optional `inviteTokenExpiresAt`, optional `inviteTokenClaimedBy`, and optional `inviteTokenClaimedAt`. The `members` table SHALL be indexed by building, by user, and by inviteToken.

#### Scenario: Resident invite lifecycle fields

- **WHEN** an admin generates a resident invite
- **THEN** the member has status `invited`, a unique token expiring seven days after generation, and no claim fields

#### Scenario: Claimed invite preserves attribution

- **WHEN** a resident claims an invite
- **THEN** the member retains its building and unit, becomes `active`, records the claiming user and time, and no longer exposes a claimable token
