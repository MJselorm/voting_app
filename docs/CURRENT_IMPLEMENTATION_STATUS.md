# UniVote current implementation status

## Implemented

### Authentication and account foundation

- React + TypeScript + Vite authentication and profile interface.
- Firebase email/password and Google authentication, verification, password reset, and browser session restoration.
- Protected frontend routes and a centralized API client attaching Firebase ID tokens.
- FastAPI Firebase token verification and verified-user dependency.
- Neon/SQLAlchemy user persistence, idempotent account synchronization, and profile retrieval/update/deletion APIs.
- Profile deletion requires Firebase reauthentication. The backend refuses deletion before contacting Firebase when organisation creator or management references would prevent safe Neon deletion.

### Organisation backend foundation

- SQLAlchemy models and Alembic migration `0002_organization_foundation` for organisations, creation requests, management assignments, audit records, and the default-false platform Super Admin flag.
- Authenticated users can submit and view their own pending organisation requests.
- Platform Super Admin endpoints support request review/approval/rejection, direct creation, initial management mode selection and handover, cross-platform listing, and suspend/restore.
- Approval assigns the requester as initial owner. Direct creation requires either explicit retained platform management or an existing active designated owner.
- Server-side authorization restricts platform operations and organisation detail access. Audit events are persisted transactionally with state changes.
- Organisation routes use `/api/v1`; see [ORGANIZATION_MANAGEMENT.md](./ORGANIZATION_MANAGEMENT.md) for the endpoint list and precise permissions.

### RBAC foundation

- Centralized platform and organisation permission registry.
- Database models for platform role assignments, organisation role assignments, and persisted platform settings.
- Alembic revision `0003_rbac_foundation`, offline-rendered and not yet applied to Neon.
- Platform overview, user-directory, role, audit, and settings APIs.
- Role-aware sidebar visibility and organisation administration route guard.
- No public Super Admin promotion endpoint; initial provisioning remains a trusted administrative operation.

## Validation

Backend: **48 tests passed** using an isolated SQLite database and mocked Firebase tokens; no tests connected to Neon. Frontend: **24 tests passed**. Frontend production build: **passed**. Alembic PostgreSQL SQL rendering passed offline for revisions `0001`, `0002`, and `0003`. `git diff --check` passed. Pytest emitted one Starlette/httpx deprecation warning; it did not affect test results.

The organization migration must be reviewed and applied to an approved non-production Neon branch before live deployment. It has not been applied to Neon. Real Firebase flows and live Neon CRUD remain unverified without configured credentials.

## Not implemented

- Organisation membership/joining, invitations, identity or roster verification, student/employee imports, or general organisation-role delegation.
- Elections, candidates, polls, voting, ballots, or results.
- Platform Super Admin self-service provisioning. The initial trusted admin must be provisioned operationally.

No real credentials or private keys are committed.
