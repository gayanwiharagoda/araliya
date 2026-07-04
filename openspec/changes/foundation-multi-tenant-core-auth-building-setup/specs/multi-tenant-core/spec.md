## ADDED Requirements

### Requirement: Building, unit, and member data model
The system SHALL define three tenant tables. `buildings` has name, address, region, currency, optional providerConfig, and createdAt. `units` has buildingId, label, and optional floorArea. `members` has buildingId, nullable userId, nullable unitId, role, status, and nullable inviteToken. The `members` table SHALL be indexed by building, by user, and by inviteToken.

#### Scenario: Building defaults for Sri Lanka
- **WHEN** a building is created without explicit region or currency
- **THEN** it is stored with region `"LK"` and currency `"LKR"`

#### Scenario: Committee-only member has no unit
- **WHEN** a committee member is added without a unit
- **THEN** the member record is stored with a null unitId and role in {admin, treasurer, resident}

### Requirement: Central role and membership guard
The backend SHALL provide a single guard `requireRole(ctx, buildingId, allowed)` that resolves the authenticated caller, loads their active membership in that building, and asserts the membership role is in `allowed`. Every domain query and mutation SHALL authorize through this guard before reading or writing building-scoped data.

#### Scenario: Member with allowed role passes
- **WHEN** an authenticated user with an active membership whose role is in `allowed` calls a guarded function for that building
- **THEN** the guard returns the membership and the operation proceeds

#### Scenario: Member with disallowed role rejected
- **WHEN** an authenticated member of the building whose role is not in `allowed` calls the function
- **THEN** the guard throws a forbidden error and the operation performs no write

#### Scenario: Non-member rejected (cross-tenant isolation)
- **WHEN** an authenticated user who has no membership in building X calls any guarded function scoped to X
- **THEN** the guard throws and the user can neither read nor mutate anything in X

#### Scenario: Unauthenticated caller rejected
- **WHEN** a caller with no identity invokes a guarded function
- **THEN** the guard throws an unauthenticated error before any building lookup

### Requirement: Create and read buildings
An authenticated user SHALL create a building, becoming its first member with role `admin` and status `active`. Users SHALL get a building they belong to and list the buildings they are a member of.

#### Scenario: Creator becomes admin
- **WHEN** an authenticated user creates a building
- **THEN** the building is stored and a members row is created linking that user to it with role `admin`, status `active`

#### Scenario: List only my buildings
- **WHEN** a user lists their buildings
- **THEN** only buildings where they have a membership are returned, and buildings of other users are excluded

#### Scenario: Get building requires membership
- **WHEN** a user requests a building they are not a member of
- **THEN** the request is rejected via the guard

### Requirement: Add and list units
A committee admin SHALL add a unit (label, optional floorArea) to a building they administer, and members SHALL list the units of a building they belong to.

#### Scenario: Admin adds a unit
- **WHEN** an admin of a building adds a unit with a label
- **THEN** a unit row is stored with that buildingId and label

#### Scenario: Non-admin cannot add a unit
- **WHEN** a resident (non-admin) of the building attempts to add a unit
- **THEN** the guard rejects the mutation and no unit is stored

#### Scenario: List units is building-scoped
- **WHEN** a member lists units for their building
- **THEN** only units of that building are returned

### Requirement: Add and list committee members
A committee admin SHALL add another committee member to a building, and members SHALL list the members of a building they belong to.

#### Scenario: Admin adds a committee member
- **WHEN** an admin adds a committee member with a role
- **THEN** a members row is stored for that building with the given role

#### Scenario: Non-admin cannot add a member
- **WHEN** a treasurer or resident attempts to add a member
- **THEN** the guard rejects the mutation

#### Scenario: List members is building-scoped
- **WHEN** a member lists members of their building
- **THEN** only members of that building are returned

### Requirement: Money stored as integer minor units
All monetary amounts introduced now or later SHALL be stored as integer minor units (LKR cents). No floating-point currency values are stored.

#### Scenario: Convention fixed
- **WHEN** any future field represents an amount of money
- **THEN** it is typed and stored as an integer number of LKR cents
