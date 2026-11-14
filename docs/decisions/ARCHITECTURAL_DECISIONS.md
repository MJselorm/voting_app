# ARCHITECTURAL_DECISIONS.md — Multi-Tenant Architectural Decision Records

This document catalogs all architectural decisions across UniVote, distinguishing confirmed prototype decisions from target multi-tenant decisions and open design questions.

---

## 1. Confirmed Architectural Decisions (Active Implementation)

### ADR-001: Firebase Authentication for Identity Management
- **Status**: Confirmed
- **Decision**: Outsource credential management, password recovery, and Google OAuth to Firebase Authentication. Passwords and password hashes are never stored in PostgreSQL.

### ADR-002: Authoritative Backend Authorization via FastAPI
- **Status**: Confirmed
- **Decision**: Frontend views and roles are presentation cues only. Authoritative access control is strictly enforced on the server using FastAPI dependency injection (`get_current_user`, `require_admin`, `require_election_official`).

### ADR-003: Official Roster Ingestion for Identity Verification
- **Status**: Confirmed
- **Decision**: Student accounts must verify identity against pre-imported official institutional records. Self-registration does not confer voting rights.

### ADR-004: PostgreSQL on Neon Serverless with Async SQLAlchemy
- **Status**: Confirmed
- **Decision**: Deploy on PostgreSQL via Neon Serverless / Supabase using SQLAlchemy 2.0 with the `asyncpg` async driver.

### ADR-005: Multi-Stage Formal Election Approval Pipeline
- **Status**: Confirmed
- **Decision**: Formal elections progress through an explicit approval pipeline (`DRAFT` → `OFFICIAL_REVIEW` → `SUPER_ADMIN_FINAL_APPROVAL` → `APPROVED`).

---

## 2. Multi-Tenant Architectural Decisions (Target Architecture)

### ADR-006: Multi-Tenant Architecture with Shared Database & Row-Level Isolation
- **Status**: Confirmed for Target Architecture
- **Decision**: UniVote will operate as a multi-tenant platform using a shared PostgreSQL database where all tenant-scoped entities enforce `organization_id` foreign keys and automatic query partitioning.
- **Consequences**: Enables low operational overhead and rapid tenant onboarding while preserving strict organizational data privacy.

### ADR-007: Universal Accounts & Decoupled Memberships
- **Status**: Confirmed for Target Architecture
- **Decision**: Decouple global user accounts (`users`) from institutional standing (`organization_memberships`). Users register once and can hold verified memberships in multiple organizations.
- **Consequences**: Eliminates account duplication when students transition between departments, clubs, or universities.

### ADR-008: Six Scoped Roles Model
- **Status**: Confirmed for Target Architecture
- **Decision**: Replace flat global roles with a 6-tier scoped role model: Platform Super Admin, Organization Admin, Election Official, Election Super Admin, Member/Voter, Poll Creator.
- **Consequences**: Accurately bounds staff authority to specific organizations or individual elections.

### ADR-009: Dual Voting Engines (Formal Elections vs. Quick Polls)
- **Status**: Confirmed for Target Architecture
- **Decision**: Build two distinct voting engines: a highly regulated **Formal Elections** module and an agile, zero-roster **Quick Polls** module.
- **Consequences**: Caters to diverse campus needs without overburdening informal surveys with electoral commission bureaucracy.

---

## 3. Open Design Decisions (Pending Investigation)

### ODD-001: Anonymous Ballot Token Storage Pattern
- **Status**: `OPEN DESIGN DECISION`
- **Context**: Allowing voters to modify their ballots prior to election close requires linking a voter's participation record to an anonymous ballot token without exposing their candidate choice in database queries.
- **Options Under Review**:
  1. *Hashed One-Time Token*: Store a blinded cryptographic token issued to the client.
  2. *Two-Table Key Rotation*: Periodically scramble and shuffle cast ballots in batches.

### ODD-002: Public Quick Poll Fraud Mitigation
- **Status**: `OPEN DESIGN DECISION`
- **Context**: Quick Polls configured with `audience_type = 'PUBLIC'` do not require organization membership.
- **Options Under Review**:
  1. Browser fingerprinting + IP subnet rate-limiting.
  2. Cloudflare Turnstile / reCAPTCHA v3.
  3. Lightweight single-use email verification tokens.
