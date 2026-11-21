# Organisation Management

This document describes the implemented organisation and membership workflows. It does not cover voter-register imports, elections, or voting.

## Data model

The organisation foundation stores organisation profiles, creation requests, management assignments, and audit records. Revision `0006_configurable_membership` adds:

- organisation membership policy fields;
- policy snapshots on membership requests and invitations;
- invitation records with hashed tokens and expiration/revocation state;
- membership verification submissions and decisions;
- a pending-only uniqueness rule for membership requests, preserving rejected and approved history.

Existing and new organisations default to administrator-approved membership, with invitations and additional verification disabled.

## Authentication and permissions

Requests require an active UniVote account authenticated by a Firebase ID token with a verified email. Organisation membership settings and member-management endpoints require an organisation owner/admin assignment. Platform Super Admin status alone does not grant organisation-level authority.

Active public organisation details are discoverable to authenticated users. Active members, assigned organisation managers, and Platform Super Admins can also read private organisation details. Suspended organisation details are restricted to assigned managers and Platform Super Admins. Platform-wide creation, request review, management handover, and suspend/restore operations remain Platform Super Admin-only.

When a Platform Super Admin directly creates an organisation with `RETAIN_PLATFORM_MANAGEMENT`, the service creates an organisation-owner management assignment and matching active owner role for that administrator. Ownership handover retains the new owner role and revokes active owner roles for other users.

## Membership policy and lifecycle

Owners/admins configure `membership_requires_approval`, `membership_requires_invitation`, and `verification_mode` (`NONE`, `INSTITUTIONAL_EMAIL`, or `ADMIN_REVIEW`). Institutional-email verification checks the verified Firebase email against configured domains. Manual verification requires administrator instructions and an explicit owner/admin decision; no submitted ID or unverified institutional record is treated as proof.

Approval-based requests, direct joins, and invitation acceptance are enforced server-side. Invitations expire, can be revoked, and can only be accepted by the invited email account. Existing pending requests and invitations retain policy snapshots when the organisation's policy changes. Administrators cannot approve their own request or verify their own affiliation.

Each membership, request, invitation, verification, policy, and review transition is audited. Email notifications use environment-configured SMTP and return explicit delivery results (`SENT`, `NOT_CONFIGURED`, `FAILED`, or `NO_RECIPIENT`).

## API

All paths below are prefixed with `/api`.

| Method and path | Access | Purpose |
|---|---|---|
| `GET /v1/organizations` | Verified active user | Discover active organisations and their membership policies |
| `GET /v1/organizations/{organization_id}` | Verified active user for active org; restricted for suspended org | Read organisation details |
| `GET /v1/organizations/{organization_id}/membership/status` | Verified active user | Read the caller's membership/request/verification state |
| `GET /v1/organizations/membership/my` | Verified active user | List the caller's active memberships |
| `PUT /v1/organizations/{organization_id}/membership-policy` | Organisation owner/admin | Update membership policy |
| `POST /v1/organizations/{organization_id}/membership-requests` | Verified active user | Submit an approval-based membership request |
| `POST /v1/organizations/{organization_id}/membership/join` | Verified active user | Join directly when policy permits |
| `POST /v1/organizations/{organization_id}/invitations/accept` | Verified active user matching invite email | Accept an invitation |
| `GET /v1/admin/organizations/{organization_id}/membership-requests` | Organisation owner/admin | List requests; defaults to pending |
| `POST /v1/admin/organizations/{organization_id}/membership-requests/{request_id}/approve` | Organisation owner/admin | Approve a pending request |
| `POST /v1/admin/organizations/{organization_id}/membership-requests/{request_id}/reject` | Organisation owner/admin | Reject a pending request with a reason |
| `GET /v1/admin/organizations/{organization_id}/membership-verifications` | Organisation owner/admin | List pending verifications |
| `POST /v1/admin/organizations/{organization_id}/membership-verifications/{verification_id}/approve` | Organisation owner/admin | Approve a manual verification |
| `POST /v1/admin/organizations/{organization_id}/membership-verifications/{verification_id}/reject` | Organisation owner/admin | Reject a manual verification with a reason |
| `GET /v1/admin/organizations/{organization_id}/invitations` | Organisation owner/admin | List invitations without changing state or sending email |
| `POST /v1/admin/organizations/{organization_id}/invitations` | Organisation owner/admin | Issue and email an invitation |
| `POST /v1/admin/organizations/{organization_id}/invitations/{invitation_id}/revoke` | Organisation owner/admin | Revoke a pending invitation |

Organisation creation, platform request review, initial management, and suspend/restore endpoints are also available to Platform Super Admins as described in the platform API.

## Email configuration

Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_FROM`, and `SMTP_USE_TLS` for delivery; set `PUBLIC_APP_URL` to the frontend's externally reachable base URL. Without SMTP configuration, invite links remain available to the issuing administrator for secure sharing, and the API reports `NOT_CONFIGURED`.

Invitation expiry is enforced on write/acceptance paths. A scheduled expiry worker may update overdue invitations and notify invitees, but the list GET endpoint is intentionally read-only.

## Migration and deployment

Revision `0006_configurable_membership` is tested with the migration chain on an isolated SQLite database and the API suite uses in-memory SQLite. Do not point migration tests at the configured Neon URL. The revision has not been applied to Neon or production; review and apply it against an approved non-production Neon branch before release.

Account deletion remains blocked when creator or management references would lose provenance. No organisation deletion endpoint is implemented.
