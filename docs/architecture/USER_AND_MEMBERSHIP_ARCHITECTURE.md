# USER_AND_MEMBERSHIP_ARCHITECTURE.md — Universal Accounts & Multi-Organization Memberships

## 1. Overview

UniVote completely decouples the global **User Account** from localized **Organization Memberships**. A single person registers once with an email address and can join multiple universities, student associations, or corporate organizations with distinct roles, identifiers, and verification statuses.

---

## 2. Core Separation of Concepts

The target architecture distinguishes five fundamental entities:

1. **User Account (`users`)**: Global platform identity. Owns email, password credentials (managed by Firebase Auth), global profile metadata, and platform-level active status.
2. **Organization (`organizations`)**: Distinct institutional tenant.
3. **Organization Membership (`organization_memberships`)**: Represents a user's relationship with a specific organization. Owns institutional ID (e.g., Student ID, Staff ID), department, organizational role, verification status, and membership state.
4. **System Role**: The authority assigned to a user within a specific scope (Platform-level vs. Org-level vs. Election-level).
5. **Voting Eligibility**: The conditional right to cast a ballot in a specific formal election or quick poll based on membership attributes or uploaded registers.

```mermaid
erDiagram
    users ||--o{ organization_memberships : "holds"
    organizations ||--o{ organization_memberships : "enrolls"
    organizations ||--o{ organization_voter_registers : "maintains"
    organization_memberships ||--o{ election_official_assignments : "assigned to"
    organization_memberships ||--o{ poll_creator_permissions : "granted"

    users {
        uuid id PK
        string firebase_uid UK
        string email UK
        string full_name
        boolean is_platform_super_admin
        boolean is_active
        timestamptz created_at
    }

    organizations {
        uuid id PK
        string name
        string slug UK
        string status
        jsonb settings
    }

    organization_memberships {
        uuid id PK
        uuid organization_id FK
        uuid user_id FK
        string member_identifier
        string role
        string department
        string level
        string status
        boolean is_verified
        timestamptz verified_at
    }

    organization_voter_registers {
        uuid id PK
        uuid organization_id FK
        string member_identifier
        string full_name
        string email
        string department
        string status
    }
```

---

## 3. Universal Registration & Onboarding Lifecycle

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

## 4. Multi-Membership Switching & Context

Users participating in multiple organizations (e.g. an engineering student who is also an executive member of the Debate Club) switch contexts seamlessly:
- The frontend dashboard provides an **Organization Switcher** component.
- Selecting an organization updates the active context (`currentOrgId`).
- Subsequent API requests provide the `X-Organization-ID` header.
- The user's role and capabilities automatically adapt to their assigned role in that specific organization.
