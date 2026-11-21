# UniVote Current Implementation Status

## Implemented

### Authentication and account foundation

- React, TypeScript, Vite, Firebase authentication, protected routes, and profile management.
- FastAPI Firebase token verification, verified-email enforcement, account synchronization, and Neon/SQLAlchemy persistence.
- Profile deletion requires recent Firebase reauthentication and is blocked when organisation creator or management references would lose provenance.

### Organisation and platform administration

- Organisation request, approval, direct creation, management handover, listing, audit, suspend, and restore APIs.
- Platform overview, user, role, audit, and settings interfaces, including the super-admin tools UI.
- Organisation-scoped owner/admin permissions remain separate from platform-super-admin access.

### Membership policy and management

- Organisation policy settings for approval-required, invitation-required, and institutional verification modes.
- Server-enforced request, direct-join, invitation, institutional-email, and manual-review flows.
- Hashed, email-bound invitation tokens with expiry and revocation; pending request and invitation policy snapshots preserve historical decisions.
- Membership request and verification review APIs and organisation-admin workflows in the UI.
- SMTP notifications report `SENT`, `NOT_CONFIGURED`, `FAILED`, or `NO_RECIPIENT`; SMTP credentials must be configured for email delivery.
- Audit events record policy changes and membership/request/invitation/verification transitions.

## Validation

- Backend: **60 tests passed** using isolated/in-memory SQLite and mocked Firebase claims.
- Frontend: **25 tests passed**.
- Frontend TypeScript check and production build: **passed**. Vite reports the existing large-chunk advisory.
- Alembic upgrade through revision `0006_configurable_membership`: **passed** on an isolated SQLite database. Migration tests must never use the configured Neon URL.
- No migration has been applied to Neon or production. Live SMTP, Firebase, and Neon operations remain unverified without their deployment configuration.

## Not implemented

- Voter-register imports or student/employee ID matching. Institutional proof is limited to verified Firebase email-domain matching or explicit manual admin review.
- Tenant switching, election eligibility, candidates, polls, ballots, voting, and results.
- Platform Super Admin self-service provisioning; initial trusted administrator provisioning remains operational.

See [AUTH_AND_MEMBERSHIP.md](./AUTH_AND_MEMBERSHIP.md) and [ORGANIZATION_MANAGEMENT.md](./ORGANIZATION_MANAGEMENT.md) for workflow contracts and endpoints.
