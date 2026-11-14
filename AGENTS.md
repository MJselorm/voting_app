# AGENTS.md — AI Coding Agent Guidelines for UniVote (Multi-Tenant Architecture)

Welcome to **UniVote**. This document serves as the primary instruction manual and architectural contract for all AI coding agents (such as Claude Code, Codex, Antigravity, and Gemini) and human contributors working on this codebase.

Every agent working on this repository must strictly adhere to the multi-tenant architecture, patterns, security constraints, and development conventions detailed below.

---

## 1. Project Overview & Target Architecture

UniVote is evolving into a multi-tenant university and organizational voting platform supporting:
- **Universities & Colleges** (Institutional ballots, student councils, faculty boards)
- **Academic Departments & Cohorts** (Department associations, course reps)
- **Student Clubs & Fraternities/Sororities**
- **Companies & Corporate Boards** (Staff reps, shareholder resolutions)
- **Professional Associations & Unions** (Executive elections, policy ratifications)

### Technology Stack:
- **Frontend**: Single Page Application (SPA) built with **React 19**, **TypeScript**, **Vite**, and **React Router DOM v7**. Target deployment on **Vercel**.
- **Backend**: Asynchronous REST API built with **FastAPI** (Python 3.11+ / 3.13), **SQLAlchemy 2.0 (AsyncIO)** with `asyncpg` and `psycopg2-binary`, and **Pydantic v2** (`pydantic-settings`). Target deployment on **Render**.
- **Authentication**: Universal **Firebase Authentication** (Email/Password, Google OAuth).
- **Identity & Token Verification**: **Firebase Admin SDK** (`firebase-admin`) executing cryptographic public key verification on every protected request.
- **Database & Persistence**: **PostgreSQL** (hosted on **Neon** / **Supabase**), managed via **Alembic** migrations.
- **Mobile Clients (Planned)**: Native / Cross-platform **iOS** and **Android** applications consuming the same FastAPI REST APIs.

---

## 2. Core Non-Negotiable Rules

Any automated or manual modification must respect the following core principles:

1. **Multi-Tenant Data Isolation**: The platform supports multiple independent organizations within shared infrastructure. Every tenant-scoped query must enforce `organization_id` isolation. Cross-tenant data visibility is strictly prohibited unless authorized under `Platform Super Admin` governance.
2. **Decoupled Universal Accounts**: User accounts (`users`) are global and universal. A user registers once with any valid email and can join multiple organizations. Institutional identifiers (Student ID, Staff ID) belong to `organization_memberships`, never as an immutable property of the global user account.
3. **Six Scoped Roles**: Roles are scoped to their respective operational domain. Never confuse **Platform Super Admin** (infrastructure/global) with **Election Super Admin** (election result sign-off).
4. **Two Distinct Voting Modules**:
   - **Formal Elections**: Formal governance ballots featuring multiple positions, candidate vetting, strict voter eligibility, FPTP balloting, vote editing before close, and certified result approval.
   - **Quick Polls**: Lightweight informal voting activities (e.g. Best Dressed, Favorite Lecturer) leveraging existing verified memberships without requiring spreadsheet roster uploads.
5. **Firebase Authentication handles credentials**: User passwords and Google OAuth tokens are handled by Firebase. Passwords and password hashes are never stored in PostgreSQL.
6. **FastAPI verifies Firebase ID tokens using Firebase Admin SDK**: Every protected route receives the Bearer token in the `Authorization` header and performs cryptographic signature checks. Never replace this with unverified manual JWT decoding.
7. **Backend authorization is authoritative**: Frontend roles and conditional UI views exist solely for presentation. FastAPI dependency injection is the sole authority for access control.
8. **Users cannot self-assign roles**: Self-registration creates a basic `Member` account. Organization Admin and Election Official roles must be assigned through trusted administrative workflows.
9. **Database changes must use SQLAlchemy models and Alembic migrations**: Schema updates must be mirrored in SQLAlchemy models and versioned with linear Alembic migrations. Never modify database tables ad-hoc.
10. **Ballot Secrecy & Decoupling**: In voting implementations, voter participation logs must be decoupled from secret cast ballots. Election officials must never be able to inspect individual secret votes.
11. **Never expose secrets**: API keys, Firebase service account credentials, database connection strings, and tokens must always be sourced from environment variables.
12. **Update relevant documentation whenever functionality changes**: When adding or altering endpoints, schemas, or workflows, update the corresponding documentation files in `docs/` immediately.
13. **Never claim an unfinished feature is implemented**: Distinguish verified existing prototype functionality from target multi-tenant roadmap items.
14. **Do not perform unrelated refactoring when implementing a requested feature**: Strictly limit modifications to the scope of the user's explicit request.

---

## 3. Scoped Role Hierarchy

| Role | Scope | Authority |
|---|---|---|
| **1. Platform Super Admin** | Global / Platform | System infrastructure, tenant creation & approval, cross-org auditing. |
| **2. Organization Admin** | Organization | Organization settings, roster uploads, membership verification, staff appointments. |
| **3. Election Official** | Election / Org | Election configuration, candidate vetting, balloting oversight, interim turnout monitoring. |
| **4. Election Super Admin** | Election / Org | Final certification and sign-off on election results. |
| **5. Member / Voter** | Organization | Verified organization member. Eligible to vote in formal elections and quick polls. |
| **6. Poll Creator** | Organization | Authorized member/staff allowed to create lightweight Quick Polls. |

---

## 4. Documentation Directory Navigation

Consult the detailed documentation files in `docs/` before implementing features:

- [docs/README.md](docs/README.md) — Documentation index and reading order.
- [docs/architecture/SYSTEM_ARCHITECTURE.md](docs/architecture/SYSTEM_ARCHITECTURE.md) — Complete system topology and multi-tenant layout.
- [docs/architecture/MULTI_TENANCY.md](docs/architecture/MULTI_TENANCY.md) — Organization lifecycle and tenant isolation rules.
- [docs/architecture/USER_AND_MEMBERSHIP_ARCHITECTURE.md](docs/architecture/USER_AND_MEMBERSHIP_ARCHITECTURE.md) — Universal accounts and membership workflows.
- [docs/architecture/ROLE_AND_PERMISSION_MODEL.md](docs/architecture/ROLE_AND_PERMISSION_MODEL.md) — 6-tier scoped role specifications.
- [docs/architecture/VOTING_ARCHITECTURE.md](docs/architecture/VOTING_ARCHITECTURE.md) — Formal Elections vs. Quick Polls engines.
- [docs/architecture/BALLOT_SECURITY.md](docs/architecture/BALLOT_SECURITY.md) — Ballot secrecy and result certification.
- [docs/planning/IMPLEMENTATION_TODO.md](docs/planning/IMPLEMENTATION_TODO.md) — Master implementation task tracker across 8 phases.
- [docs/planning/CURRENT_IMPLEMENTATION_STATUS.md](docs/planning/CURRENT_IMPLEMENTATION_STATUS.md) — Gap analysis of existing code vs. target architecture.
- [docs/planning/PRODUCT_ROADMAP.md](docs/planning/PRODUCT_ROADMAP.md) — Strategic roadmap.
- [docs/decisions/ARCHITECTURAL_DECISIONS.md](docs/decisions/ARCHITECTURAL_DECISIONS.md) — Architectural Decision Records (ADRs).
