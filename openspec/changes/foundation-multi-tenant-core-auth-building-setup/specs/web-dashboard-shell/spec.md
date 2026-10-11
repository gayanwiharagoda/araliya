## ADDED Requirements

### Requirement: Web authentication UI

The web app SHALL present sign up and sign in forms and establish an authenticated Convex session on success. Unauthenticated users SHALL NOT see the dashboard.

#### Scenario: Sign up then land on dashboard

- **WHEN** a visitor completes the sign up form with a valid email and password
- **THEN** they are authenticated and shown the dashboard shell

#### Scenario: Unauthenticated user is gated

- **WHEN** an unauthenticated visitor opens the dashboard route
- **THEN** they are shown the auth UI instead of building data

### Requirement: Create building from the dashboard

An authenticated admin SHALL create a building from the dashboard and see it listed.

#### Scenario: Create and see building

- **WHEN** an authenticated user submits the create-building form with a name
- **THEN** the building is created and appears in their list of buildings

### Requirement: Manage units and members from the dashboard

Within a building they administer, an admin SHALL add units and view the member list.

#### Scenario: Add a unit

- **WHEN** an admin submits the add-unit form with a label
- **THEN** the unit appears in the building's unit list

#### Scenario: View members

- **WHEN** an admin opens the members view for their building
- **THEN** the building's members are listed
