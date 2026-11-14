# DATABASE_ARCHITECTURE.md — Multi-Tenant Database Design

## 1. Overview

The UniVote database architecture is evolving from a single-institution schema into a multi-tenant relational schema powered by **PostgreSQL**, managed with **SQLAlchemy 2.0 (AsyncIO)** and **Alembic**.

---

## 2. Multi-Tenant Relational Schema Diagram

```mermaid
erDiagram
    organizations ||--o{ organization_memberships : "enrolls"
    organizations ||--o{ organization_voter_registers : "maintains"
    organizations ||--o{ elections : "hosts"
    organizations ||--o{ quick_polls : "hosts"
    
    users ||--o{ organization_memberships : "participates as"
    
    elections ||--o{ election_positions : "contains"
    elections ||--o{ election_official_assignments : "assigns"
    elections ||--o{ election_approvals : "reviewed by"
    elections ||--o{ election_audit_logs : "tracks"
    elections ||--o{ voter_participation_records : "tracks turnout"
    elections ||--o{ cast_ballots : "contains anonymous votes"

    quick_polls ||--o{ quick_poll_options : "offers"
    quick_polls ||--o{ quick_poll_votes : "records votes"

    organizations {
        uuid id PK
        string name
        string slug UK
        string status
        jsonb settings
        timestamptz created_at
    }

    organization_memberships {
        uuid id PK
        uuid organization_id FK
        uuid user_id FK
        string member_identifier
        string role
        string department
        string status
        boolean is_verified
        timestamptz verified_at
    }

    elections {
        uuid id PK
        uuid organization_id FK
        string name
        enum status
        enum result_visibility
        jsonb eligibility_criteria
        uuid created_by FK
        timestamptz start_at
        timestamptz end_at
    }

    quick_polls {
        uuid id PK
        uuid organization_id FK
        string title
        text description
        string audience_type
        uuid created_by FK
        timestamptz expires_at
    }
```

---

## 3. Schema Transition & Migration Roadmap

### Phase A: Current Existing Tables (Single-Tenant Prototype)
- `users`: Stores global user accounts with an embedded university `student_id`.
- `students`: Stores official student records for a single university.
- `student_imports`: Tracks spreadsheet imports for the university.
- `elections`, `election_positions`, `election_official_assignments`, `election_approvals`, `election_audit_logs`.

### Phase B: Target Multi-Tenant Additions (Future Migrations)
1. **`organizations` Table**: Stores tenant metadata, institutional domain constraints, and branding.
2. **`organization_memberships` Table**: Decouples `student_id` from `users`, allowing users to have memberships across multiple organizations.
3. **`organization_voter_registers` Table**: Replaces the single-institution `students` table with tenant-scoped voter rosters.
4. **`quick_polls` & `quick_poll_options` Tables**: Implements the lightweight quick polling module.
5. **`cast_ballots` & `voter_participation_records` Tables**: Implements cryptographic vote secrecy.
