## ADDED Requirements

### Requirement: Resident claims an invite once

The system SHALL let a mobile resident with an anonymous Convex Auth identity claim a valid invite token atomically. Claiming SHALL bind that identity to the invited member, set the member status to `active`, record the claim time, and clear the token.

#### Scenario: Valid token activates the resident

- **WHEN** an anonymous authenticated resident claims an unexpired, unclaimed invite token
- **THEN** the member is bound to that user and unit, marked `active`, and the token is cleared

#### Scenario: Claimed token is rejected

- **WHEN** any user attempts to claim an already claimed token
- **THEN** the mutation rejects it and does not change the member

#### Scenario: Invalid or expired token is rejected

- **WHEN** a user claims an unknown token or a token older than seven days
- **THEN** the mutation rejects it and does not change any member

### Requirement: Mobile invite route reports claim state

The mobile app SHALL handle `domusos://invite?token=<token>`, establish an anonymous session, and claim the token. It SHALL show a clear error for invalid, expired, or claimed tokens.

#### Scenario: Deep link claims invite

- **WHEN** the app opens a valid invite deep link
- **THEN** it establishes an anonymous session, claims the invite, and shows the resident landing state

#### Scenario: Invalid invite shows an error

- **WHEN** the app opens an invalid, expired, or claimed invite link
- **THEN** it shows a clear error without activating a member
