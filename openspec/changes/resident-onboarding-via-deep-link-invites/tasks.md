## 1. Invite lifecycle backend

- [x] 1.1 Extend the member schema with seven-day invite expiry and claim metadata; configure anonymous Convex Auth
- [x] 1.2 Add admin-only invite generation with a unique token, resident membership, and app/fallback URLs
- [x] 1.3 Add an atomic invite claim mutation that validates token state, binds the anonymous user, activates the member, and burns the token
- [x] 1.4 Add Convex integration coverage for generation, successful claim, duplicate claim, unknown token, and expiry

## 2. Web invite generation

- [x] 2.1 Add the admin dashboard control to generate and copy a unit invite link
- [x] 2.2 Add the HTTPS invite fallback route
- [x] 2.3 Add a web integration test for the invite-generation control

## 3. Mobile redemption

- [x] 3.1 Add the invite deep-link route, anonymous sign-in, claim flow, resident landing state, and clear claim errors
- [x] 3.2 Add a mobile integration test for invite route loading and claim error display

## 4. Verification

- [x] 4.1 Run pnpm validate
- [ ] 4.2 Manually open a valid and an expired invite deep link on a simulator
