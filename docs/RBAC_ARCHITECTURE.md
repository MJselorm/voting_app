# UniVote RBAC Architecture

## Authority separation

Firebase Authentication verifies identity. PostgreSQL is authoritative for application roles and permissions.

- Platform authority is represented by `users.is_platform_super_admin` and `platform_role_assignments`.
- Organization authority is represented by `organization_role_assignments`.
- Organization owners, organization admins, election officials, and members are organization-scoped.
- Platform role assignments do not grant an organization-management role, and organization roles do not grant platform authority.

The existing organization ownership assignment remains compatible with the organization role model. A Super Admin handover removes the Super Admin from organization-level management while preserving platform oversight.

## Roles and permissions

The centralized mappings are in `backend/app/auth/permissions.py`.

Platform Super Admin permissions cover dashboard, organization directory and lifecycle, user and role administration, audit visibility, and platform settings.

Organization roles cover:

- `ORGANISATION_OWNER`: organization view/update, delegated role management, member management, elections and results.
- `ORGANISATION_ADMIN`: organization view/update and explicitly delegated administration, member and election responsibilities.
- `ELECTION_OFFICIAL`: organization view and election/results responsibilities.
- `MEMBER`: organization view and member visibility only.

Future election and membership modules must continue to enforce permissions from the backend database, not from frontend state or Firebase claims.

## Database

Alembic revision `0003_rbac_foundation` adds:

- `platform_role_assignments`
- `organization_role_assignments`
- `platform_settings`

Both role assignment tables support active/revoked state and assignment provenance. Organization assignments include organization scope and an active-owner uniqueness index. Platform settings are persisted key/value records with optional descriptions.

The migration has been rendered offline but has not been applied to Neon.

## Authorization

Protected operations use FastAPI dependencies and database lookups. The flow is:

1. Verify Firebase bearer token.
2. Resolve the active application user.
3. Check the database platform flag or organization role assignment.
4. Validate the required permission and organization scope.
5. Execute the operation transactionally.

The backend continues to return 401 for unauthenticated requests and 403 for authenticated users without permission.

## Provisioning and safeguards

There is no public Super Admin promotion endpoint. Provision the initial platform admin through an approved administrative database/operations process.

The platform role API can assign or revoke Super Admin role assignments while:

- rejecting duplicate active assignments,
- preventing removal of the last active Super Admin,
- keeping revocation audit-visible,
- preventing owner self-promotion through the organization-role endpoint.

## Frontend

The profile response includes `is_platform_super_admin`. The application shell uses this database-backed value to show Platform Administration navigation, while the organization console also rejects ordinary users. Frontend role checks improve navigation; every operation remains protected by FastAPI.

## Audit and settings

Platform role assignment changes and organization role assignments are written to the organization audit table or platform audit response. Ordinary dashboard users cannot edit or delete audit records. Platform settings are real persisted key/value records, not decorative settings.
