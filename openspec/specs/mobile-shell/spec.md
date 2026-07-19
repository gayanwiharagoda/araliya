# mobile-shell

## Purpose

Mobile invite landing.

## Requirements

### Requirement: Mobile app wired to Convex on an invite-landing state

The mobile app SHALL initialize the Convex client and render an "enter via invite" landing state. Full resident onboarding is out of scope (ticket 2).

#### Scenario: App boots to invite landing

- **WHEN** the mobile app launches
- **THEN** the Convex client is initialized and an "enter via invite" screen is shown (no task demo UI)

#### Scenario: No committee auth on mobile yet

- **WHEN** a user opens the mobile app
- **THEN** they are not offered committee sign up / sign in (that is web-only in this ticket)
