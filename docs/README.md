# UniVote Developer Documentation Index

Welcome to the **UniVote** multi-tenant developer and architectural documentation.

This directory contains the authoritative specification, engineering guides, and phased implementation plans for the UniVote platform.

---

## Documentation Structure

### 1. Architecture (`docs/architecture/`)
Core multi-tenant models, system topology, security boundaries, and voting mechanics:
- **[SYSTEM_ARCHITECTURE.md](architecture/SYSTEM_ARCHITECTURE.md)** — Multi-tenant system architecture, platform topology, and backend domain engines.
- **[MULTI_TENANCY.md](architecture/MULTI_TENANCY.md)** — Tenant isolation model, organization lifecycle, and data partitioning strategy.
- **[USER_AND_MEMBERSHIP_ARCHITECTURE.md](architecture/USER_AND_MEMBERSHIP_ARCHITECTURE.md)** — Universal accounts decoupled from multi-organization memberships.
- **[ROLE_AND_PERMISSION_MODEL.md](architecture/ROLE_AND_PERMISSION_MODEL.md)** — Six scoped roles: Platform Super Admin, Org Admin, Election Official, Election Super Admin, Member, Poll Creator.
- **[VOTING_ARCHITECTURE.md](architecture/VOTING_ARCHITECTURE.md)** — Dual voting engine: Formal Elections vs. Quick Polls.
- **[BALLOT_SECURITY.md](architecture/BALLOT_SECURITY.md)** — Separation of voter participation from secret cast ballots, vote editing, and auditability.
- **[DATABASE_ARCHITECTURE.md](architecture/DATABASE_ARCHITECTURE.md)** — Multi-tenant relational schema design and migration roadmap.

---

### 2. Modules (`docs/modules/`)
Functional specifications for platform capabilities:
- **[ORGANIZATION_MANAGEMENT.md](modules/ORGANIZATION_MANAGEMENT.md)** — Platform onboarding, organization settings, departments, and staff delegation.
- **[MEMBERSHIP_MANAGEMENT.md](modules/MEMBERSHIP_MANAGEMENT.md)** — Membership lifecycle, states, and automated roster cross-matching.
- **[VOTER_ELIGIBILITY.md](modules/VOTER_ELIGIBILITY.md)** — Tenant-scoped roster ingestion (.csv, .xlsx), conflict resolution, and position-specific overrides.
- **[FORMAL_ELECTIONS.md](modules/FORMAL_ELECTIONS.md)** — Multi-position balloting, FPTP voting, vote editing before close, and certified sign-off.
- **[QUICK_POLLS.md](modules/QUICK_POLLS.md)** — Lightweight informal voting, zero-roster member voting, and public/group audience targeting.
- **[RESULTS_AND_APPROVALS.md](modules/RESULTS_AND_APPROVALS.md)** — Result tallying, visibility controls, and Election Super Admin certification.

---

### 3. Technical Implementation (`docs/technical/`)
Codebase architecture, frameworks, and developer standards:
- **[FRONTEND.md](technical/FRONTEND.md)** — React 19, Vite, routing guards, and state management.
- **[BACKEND.md](technical/BACKEND.md)** — FastAPI application lifespan, async database sessions, and service layer.
- **[API_DESIGN.md](technical/API_DESIGN.md)** — REST path conventions, status codes, and Pydantic serialization standards.
- **[DATABASE.md](technical/DATABASE.md)** — PostgreSQL connection pooling, asyncpg tuning, and Alembic migrations.
- **[AUTHENTICATION.md](technical/AUTHENTICATION.md)** — Firebase ID token lifecycle and cryptographic public-key validation.
- **[DEPLOYMENT.md](technical/DEPLOYMENT.md)** — Production hosting on Vercel (Frontend), Render (Backend), and Neon/Supabase (Database).

---

### 4. Planning & Roadmap (`docs/planning/`)
Project status and implementation checklists:
- **[PRODUCT_ROADMAP.md](planning/PRODUCT_ROADMAP.md)** — High-level strategic roadmap across 8 development phases.
- **[IMPLEMENTATION_TODO.md](planning/IMPLEMENTATION_TODO.md)** — Comprehensive master task checklist with verified codebase statuses.
- **[CURRENT_IMPLEMENTATION_STATUS.md](planning/CURRENT_IMPLEMENTATION_STATUS.md)** — Detailed gap analysis comparing prototype code against the target multi-tenant architecture.
- **[DEVELOPMENT_PHASES.md](planning/DEVELOPMENT_PHASES.md)** — Phased engineering transition plan preserving backward compatibility.
- **[FUTURE_EXPANSION.md](planning/FUTURE_EXPANSION.md)** — Mobile apps (iOS & Android) and Student Information System (SIS) direct integrations.

---

### 5. Architectural Decisions (`docs/decisions/`)
- **[ARCHITECTURAL_DECISIONS.md](decisions/ARCHITECTURAL_DECISIONS.md)** — Complete catalog of active ADRs, multi-tenant ADRs, and open design decisions.
