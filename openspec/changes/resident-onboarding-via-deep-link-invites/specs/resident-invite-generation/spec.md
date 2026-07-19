## ADDED Requirements

### Requirement: Admin generates an invite link for a unit

The system SHALL allow a committee admin to generate a single-use, optionally expiring invite link for a unit. The link SHALL contain an `inviteToken` that identifies the invited member.

#### Scenario: Admin creates an invite link

- **WHEN** an admin of a building selects a unit and requests an invite link
- **THEN** a `members` row is created with `role = "resident"`, `unitId` set to that unit, `status = "invited"`, a unique `inviteToken`, and an optional `inviteExpiresAt`; the response contains both an app-scheme link and an HTTPS fallback link containing the token

#### Scenario: Non-admin cannot generate an invite link

- **WHEN** a treasurer or resident of a building attempts to generate an invite link
- **THEN** the guard rejects the mutation and no member or invite token is created

#### Scenario: Each generated token is unique

- **WHEN** an admin generates two invite links for the same unit
- **THEN** each member row has a distinct `inviteToken`

### Requirement: Invite link format includes app scheme and HTTPS fallback

The system SHALL return an invite link in two forms: a deep link using the app scheme, and an HTTPS fallback that can be shared in WhatsApp and opened on devices without the app.

#### Scenario: Generated link contains both forms

- **WHEN** an admin generates an invite link with token `abc123`
- **THEN** the response includes `domus://invite?token=abc123` and `https://<domain>/invite?token=abc123`
