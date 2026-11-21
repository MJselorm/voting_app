# Authentication and Organisation Membership

UniVote uses Firebase for identity and FastAPI/SQLAlchemy for application accounts and organisation membership. A verified account email confirms mailbox ownership; it does not by itself grant organisation membership.

## Identity and authorization

- Membership endpoints require an active UniVote account authenticated by a Firebase ID token with `email_verified = true`.
- Platform Super Admin permissions do not imply organisation-owner or organisation-admin permissions. Membership policy, invitation, request-review, and verification-review operations require an active owner/admin assignment for that organisation.
- Institutional-email verification matches the verified Firebase account email against the organisation's configured domains. Submitted text or identity documents are not treated as verified records.
- `ADMIN_REVIEW` is a manual decision by an organisation owner/admin. It does not create or consult a fabricated institutional roster.

## Membership policy

Each active organisation has a policy with:

- `membership_requires_approval` (defaults to `true` for existing and new organisations);
- `membership_requires_invitation` (defaults to `false`);
- `verification_mode`: `NONE`, `INSTITUTIONAL_EMAIL`, or `ADMIN_REVIEW`;
- approved email domains for `INSTITUTIONAL_EMAIL`, or instructions for `ADMIN_REVIEW`.

The policy is managed using `PUT /api/v1/organizations/{organization_id}/membership-policy`. `INSTITUTIONAL_EMAIL` requires one or more valid domains; manual review requires administrator instructions.

## Joining paths

- **Approval required, no invitation required:** `POST /api/v1/organizations/{organization_id}/membership-requests` creates a pending request.
- **Direct join:** `POST /api/v1/organizations/{organization_id}/membership/join` activates membership unless configured verification is pending.
- **Invitation required:** an owner/admin issues a time-limited invitation; the invitee must sign in with the invited email and accept the token at `POST /api/v1/organizations/{organization_id}/invitations/accept`.
- **Verification:** institutional email is checked against the verified Firebase email; manual verification remains pending until an owner/admin approves or rejects it. A request that also requires membership approval still needs separate request approval after verification.

Request, invitation, and verification records preserve the policy applicable when submitted. Rejected requests may be resubmitted without deleting their history. Invitation tokens are random, stored only as SHA-256 hashes, bound to an email and organisation, and may be revoked or expire.

## Membership states and audit

Active membership is stored separately from pending/rejected membership requests and verification decisions. Membership, request, invitation, verification, policy-change, and review transitions are recorded in organisation audit logs. Administrators cannot approve their own membership request or verify their own affiliation.

## Email notifications

Membership notifications use SMTP configured by `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_FROM`, and `SMTP_USE_TLS`. `PUBLIC_APP_URL` is used to construct application links. Delivery outcomes are reported as `SENT`, `NOT_CONFIGURED`, `FAILED`, or `NO_RECIPIENT`; an unconfigured mail server is never reported as a successful delivery.

## Not included

This implementation does not provide voter-register imports, student/employee ID matching, an organisation switcher, election eligibility, or election/voting flows. Membership does not itself establish voting eligibility.
