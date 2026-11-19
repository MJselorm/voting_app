# Organisation Management — Backend Foundation

This document records the implemented organisation-management backend foundation. It does not describe membership, invitation, voter-register, election, poll, or voting functionality; those remain separate stages.

## Data model

Alembic revision `0002_organization_foundation` follows `0001_create_users` and adds:

- `organizations`: organisation profile, unique slug, type, status, creator, approver, approval time, and timestamps.
- `organization_requests`: submitted profile/supporting details, requester, review state/reason, reviewer, resulting organisation, and timestamps. Requests remain separate from active organisations until approval.
- `organization_management_assignments`: user-to-organisation `ORGANISATION_OWNER` / `ORGANISATION_ADMIN` assignments. A unique constraint prevents duplicate user assignments; a partial unique index allows only one owner.
- `organization_audit_logs`: application event records for submissions, review decisions, direct creation, initial management assignments/handovers, and suspension/restoration. No API for editing audit events is exposed.
- `users.is_platform_super_admin`: default-false platform-scoped authorization flag.

Foreign keys preserve provenance: organisation creators and assigned managers are restricted from account deletion while referenced; requester/reviewer/approver/audit actor references are nullable with `SET NULL`; management assignments cascade only if their organisation is deleted. No organisation deletion endpoint is implemented.

Organisation types: `UNIVERSITY`, `DEPARTMENT`, `COMPANY`, `ASSOCIATION`, `CLUB`, `OTHER`.

Organisation statuses: `PENDING_APPROVAL`, `ACTIVE`, `REJECTED`, `SUSPENDED`, `ARCHIVED`. Requests independently use `PENDING_APPROVAL`, `APPROVED`, or `REJECTED`. Approval creates an `ACTIVE` organisation and links it to the request.

## Authentication and permissions

All endpoints use the existing Firebase bearer-token verification and active Neon user dependency. Platform administration additionally requires `users.is_platform_super_admin = true`, enforced by FastAPI—not request payloads or frontend state. There is deliberately no API to grant this flag. Bootstrap/provision platform administrators using a trusted operator-controlled database process; never expose self-promotion.

Organisation details are visible only to a Platform Super Admin or a user with an assignment for that organisation. Approval assigns the request's active requester as its initial owner. A requester receives no management assignment before approval. Direct creation and management changes are Platform Super Admin only.

Platform-level authority and organisation management are distinct records/scopes. In “retain platform management” mode, the acting Super Admin is explicitly assigned as the initial organisation owner. In “assign owner” mode, the selected existing active UniVote user becomes owner. A later handover demotes other existing owners to organisation admins and removes the acting Super Admin's organisation assignment; it never changes the Super Admin's platform flag. This foundation does not implement a general membership system or self-service role delegation.

## API

| Method and path | Access | Purpose |
|---|---|---|
| `POST /api/v1/organizations/requests` | Verified active user | Submit a pending request |
| `GET /api/v1/organizations/requests/me` | Verified active user | List only the caller's requests |
| `GET /api/v1/organizations/{organization_id}` | Platform Super Admin or assigned manager | Read authorized organisation details |
| `GET /api/v1/admin/organizations` | Platform Super Admin | Paginated platform-wide list; optional `status` filter |
| `GET /api/v1/admin/organization-requests` | Platform Super Admin | Paginated requests; defaults to pending |
| `GET /api/v1/admin/organization-requests/{request_id}` | Platform Super Admin | Review request details |
| `POST /api/v1/admin/organization-requests/{request_id}/approve` | Platform Super Admin | Activate organisation, assign requester as owner, record approval |
| `POST /api/v1/admin/organization-requests/{request_id}/reject` | Platform Super Admin | Reject pending request with required reason |
| `POST /api/v1/admin/organizations` | Platform Super Admin | Directly create active organisation with an explicit initial management mode |
| `PUT /api/v1/admin/organizations/{organization_id}/management` | Platform Super Admin | Retain platform management or hand owner assignment to a designated user |
| `POST /api/v1/admin/organizations/{organization_id}/suspend` | Platform Super Admin | Suspend an active organisation |
| `POST /api/v1/admin/organizations/{organization_id}/restore` | Platform Super Admin | Restore a suspended organisation |

Lists accept `offset` and `limit` (maximum 100). Request bodies reject extra/protected fields. Slugs are normalized from the organisation name unless a Super Admin supplies a valid explicit slug. Unique-slug conflicts return `409`; they do not complete/alter a request review.

## Transactions and audit trail

Each state transition and its audit event are committed together. Approval creates the organisation, owner assignment, request state change, and audit entries in one database transaction. Direct creation writes both the organisation and initial assignment atomically. Owner handover demotes/removes the prior owner and assigns the new owner in one transaction; the database partial unique index prevents concurrent duplicate owners. Status changes accept only `ACTIVE → SUSPENDED` and `SUSPENDED → ACTIVE`.

Audit action names include `ORGANIZATION_REQUEST_SUBMITTED`, `ORGANIZATION_REQUEST_APPROVED`, `ORGANIZATION_REQUEST_REJECTED`, `ORGANIZATION_CREATED_DIRECTLY`, `ORGANIZATION_MANAGEMENT_ASSIGNED`, `ORGANIZATION_MANAGEMENT_RETAINED`, `ORGANIZATION_MANAGEMENT_HANDED_OVER`, `ORGANIZATION_SUSPENDED`, and `ORGANIZATION_RESTORED`.

## Migration and deployment

The migration has been tested by rendering Alembic SQL offline and using the isolated SQLite API tests. It has not been applied to Neon or any production database. Review and apply `alembic upgrade head` only against an approved non-production Neon branch first; use a direct (non-pooler) connection for migrations and follow the project's backup/release process.

Because `created_by` and management assignments preserve user references, the existing account-deletion flow now rejects deletion before contacting Firebase when the user created or manages an organisation. A future ownership-transfer/archive policy must explicitly resolve creator provenance before this restriction can be relaxed.

## Explicitly out of scope

No organisation membership/joining, invitations, student/employee verification, units/departments as tenant sub-entities, register imports, elections, polls, candidates, ballots, voting, or results are implemented. `ORGANISATION_ADMIN` exists only as a management-assignment role foundation; no general assignment/delegation API is exposed in this stage.
