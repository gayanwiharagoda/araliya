## ADDED Requirements

### Requirement: Committee admin sign up
The system SHALL allow a committee admin to create an account with email and password via the Convex Auth Password provider.

#### Scenario: Successful sign up
- **WHEN** a visitor submits a valid, previously-unused email and a password
- **THEN** a user record is created and the caller is authenticated (a session/identity is established)

#### Scenario: Duplicate email rejected
- **WHEN** a visitor submits an email that already has an account
- **THEN** sign up fails and no second user record is created

### Requirement: Committee admin sign in
The system SHALL authenticate an existing committee admin given a matching email and password.

#### Scenario: Successful sign in
- **WHEN** a registered admin submits their correct email and password
- **THEN** the caller is authenticated and subsequent requests carry their identity

#### Scenario: Wrong password rejected
- **WHEN** a registered admin submits an incorrect password
- **THEN** authentication fails and no identity is established

### Requirement: Resolve authenticated user
The backend SHALL expose a server helper that returns the authenticated caller's user id, or throws when the caller is unauthenticated.

#### Scenario: Unauthenticated call rejected
- **WHEN** a domain function that requires auth is called with no authenticated identity
- **THEN** the call throws an unauthenticated error and performs no read or write

#### Scenario: Authenticated call resolves user id
- **WHEN** an authenticated caller invokes a domain function
- **THEN** the helper returns their user id for use in authorization
