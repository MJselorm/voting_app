# DECISIONS.md — UniVote Architectural Decision Records (ADRs)

This document records key architectural decisions, context, trade-offs, and consequences across the UniVote system.

---

## ADR-001: Firebase Authentication for Identity Management
- **Status**: Confirmed
- **Context**: Developing an electronic university voting platform requires strict credential management, multi-factor support, password reset workflows, and social/Google authentication without introducing high maintenance overhead or password hash storage liabilities.
- **Decision**: Outsource user authentication to Firebase Authentication. The client authenticates against Firebase and acquires a JWT ID token. The backend verifies the token using the Firebase Admin SDK.
- **Consequences**:
  - *Positive*: No passwords or sensitive credential hashes are stored in the PostgreSQL database. Security standards (SOC2, OAuth2 compliance) are delegated to Google.
  - *Negative*: Introduces an external cloud dependency for authentication. Requires configuring Firebase Admin service account credentials in the API environment.

---

## ADR-002: Authoritative Backend Authorization via FastAPI
- **Status**: Confirmed
- **Context**: Single-page applications can easily be tampered with in the user's browser (e.g. modifying JavaScript local state or inspecting protected UI components).
- **Decision**: Treat all frontend role information as non-authoritative presentation cues. Authoritative access control is strictly enforced on the server using FastAPI dependency injection (`get_current_user`, `require_admin`, `require_election_official`).
- **Consequences**:
  - *Positive*: Hardens the application against role-spoofing attacks.
  - *Negative*: Every protected endpoint must execute a token verification and database user role query.

---

## ADR-003: Official Student Records as Authoritative Identity Source
- **Status**: Confirmed
- **Context**: Anyone can create an email account or register with a forged student ID. The system must verify that a student voter is genuinely enrolled at the institution.
- **Decision**: Maintain a separate, official `students` roster table populated via administrative CSV/Excel imports. Student accounts are considered verified only when `student_id`, normalized full name, and email strictly match an active record in `students`.
- **Consequences**:
  - *Positive*: Completely decouples public user self-registration from institutional enrollment data. Allows institutions to maintain data sovereignty using existing spreadsheet exports.
  - *Negative*: Verification depends on the quality and formatting of uploaded rosters. Name normalization must handle whitespace and case variance.

---

## ADR-004: Decoupling Identity Verification from Election Eligibility
- **Status**: Confirmed
- **Context**: A student might be an authentic enrolled student, but elections have varying scopes (e.g., Computer Science Department elections vs. School of Engineering vs. General SRC).
- **Decision**: Separate verification into two phases:
  1. *Identity Verification*: Confirms the user is a registered, active university student (one-time).
  2. *Election Eligibility*: Evaluates whether a verified student is allowed to participate in a specific election based on dynamic target criteria (department, level, class).
- **Consequences**:
  - *Positive*: High reusability. Once verified, a student can vote in departmental elections and general SRC elections without re-verifying.
  - *Negative*: Requires two separate check layers during ballot retrieval and voting.

---

## ADR-005: PostgreSQL on Neon Serverless with Async SQLAlchemy
- **Status**: Confirmed
- **Context**: The database must handle peak concurrent loads during high-turnout election hours, support complex relational queries, and offer automated scaling with SSL/TLS.
- **Decision**: Deploy on PostgreSQL via Neon Serverless (and Supabase) using SQLAlchemy 2.0 with the `asyncpg` async driver.
- **Consequences**:
  - *Positive*: High concurrency via async non-blocking I/O. Native JSONB column support for flexible eligibility rules and audit details.
  - *Negative*: Async SQLAlchemy requires explicit eager-loading patterns (`selectinload`) to avoid greenlet errors.

---

## ADR-006: Multi-Stage Election Workflow and Approval Pipeline
- **Status**: Confirmed
- **Context**: Institutional governance requires oversight before an election becomes visible or accessible to students.
- **Decision**: Model election status as a formal state machine (`DRAFT` → `PENDING_APPROVAL` / `OFFICIAL_REVIEW` → `SUPER_ADMIN_FINAL_APPROVAL` → `APPROVED` → `SCHEDULED` → `LIVE` → `ENDED`).
- **Consequences**:
  - *Positive*: Prevents unauthorized or improperly configured ballots from going live. Provides audit accountability through `election_approvals` and `election_audit_logs`.
  - *Negative*: Adds workflow steps before an election can begin.

---

## ADR-007: Single-Query Live Database Statistics
- **Status**: Confirmed
- **Context**: Calculating Super Admin dashboard totals (registered users, eligible voters, roster totals) must remain fast without loading large datasets into memory.
- **Decision**: Implement exact database `COUNT()` queries wrapped in a single SQL execution (`GET /api/auth/admin/dashboard-stats`) backed by partial indexes (Migration `007`).
- **Consequences**:
  - *Positive*: Constant response time even with tens of thousands of student records. Minimal database memory and network bandwidth consumption.
  - *Negative*: Requires maintaining specialized partial indexes in Alembic.
