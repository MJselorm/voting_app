# AUTH_AND_MEMBERSHIP.md — Universal Accounts & Organization Membership

This document specifies the authentication mechanics, registration flows, and multi-organization membership lifecycle in **UniVote**.

---

## 1. Universal Accounts vs. Organization Memberships

UniVote enforces a fundamental separation between platform identity and institutional membership:

| Concept | Scope | Stored Entity | Key Attributes |
|---|---|---|---|
| **User Account** | Global / Platform | `users` | `firebase_uid`, `email`, `full_name`, `is_platform_super_admin`, `is_active` |
| **Organization** | Tenant | `organizations` | `name`, `slug`, `status`, `settings` |
| **Organization Membership**| Tenant-Specific | `organization_memberships` | `organization_id`, `user_id`, `member_identifier`, `role`, `department`, `status`, `is_verified` |
| **Voter Eligibility** | Event / Ballot | Evaluated dynamically | Criteria matching based on membership attributes or uploaded registers |

> **Important**: Email verification establishes only that the user owns their email address. It does **not** grant institutional membership or voting rights.

---

## 2. Universal Registration & Onboarding Lifecycle

```mermaid
sequenceDiagram
    autonumber
    actor Person as End User
    participant Auth as Firebase Auth
    participant API as FastAPI Backend
    participant DB as PostgreSQL

    Person->>Auth: 1. Sign up with email & password (or Google OAuth)
    Auth-->>Person: 2. Verification email dispatched
    Person->>Auth: 3. Clicks verification link (email_verified = true)
    Person->>API: 4. POST /api/auth/sync (Creates global User account)
    API->>DB: INSERT INTO users (email, full_name, firebase_uid)
    Person->>API: 5. Browse / Select Organization (e.g. "University of Ghana")
    Person->>API: 6. POST /api/orgs/{org_id}/join (Submits student ID & institutional details)
    API->>DB: INSERT INTO organization_memberships (status='PENDING_VERIFICATION', role='MEMBER')
    Person->>API: 7. POST /api/orgs/{org_id}/verify (Initiates identity cross-check)
    API->>DB: Cross-check against organization_voter_registers
    alt Match Found & Active
        API->>DB: UPDATE organization_memberships SET is_verified=true, status='ACTIVE'
        API-->>Person: Membership Activated! Access granted to eligible ballots.
    else Match Failed
        API-->>Person: Verification Failed (Contact Organization Admin)
    end
```

---

## 3. Membership States

Every user's relationship with an organization progresses through explicit states:

```mermaid
stateDiagram-v2
    [*] --> PENDING_VERIFICATION: User Joins Organization & Submits ID
    PENDING_VERIFICATION --> ACTIVE: Successful Cross-Match against Register
    PENDING_VERIFICATION --> MANUAL_REVIEW: Details Require Staff Inspection
    MANUAL_REVIEW --> ACTIVE: Org Admin Approves Verification
    MANUAL_REVIEW --> REJECTED: Org Admin Declines
    ACTIVE --> SUSPENDED: Disciplinary Hold / Withdrawal
    SUSPENDED --> ACTIVE: Reinstatement by Org Admin
    ACTIVE --> ALUMNI_INACTIVE: Graduation / Departure
    ALUMNI_INACTIVE --> [*]
```

- **`PENDING_VERIFICATION`**: User joined the organization; automated cross-matching against the uploaded register is in progress.
- **`ACTIVE`**: Identity verified. User may access member quick polls and check formal election eligibility.
- **`MANUAL_REVIEW`**: Slight name mismatches or special enrollment statuses escalated to the Organization Admin.
- **`SUSPENDED`**: Member temporarily barred from voting or participating.
- **`ALUMNI_INACTIVE`**: Retains historical audit participation without active voting privileges.

---

## 4. Multi-Organization Switching

A user may belong to multiple organizations concurrently (e.g. a student enrolled at a University who is also an executive member of an Engineering Association):
- The client UI provides an **Organization Switcher**.
- The frontend tracks the active tenant (`currentOrgId`) and attaches the `X-Organization-ID` header to all API requests.
- The user's role and capabilities adapt automatically to their specific assigned role within that tenant.
