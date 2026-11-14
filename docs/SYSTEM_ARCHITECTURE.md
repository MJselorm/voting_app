# SYSTEM_ARCHITECTURE.md — Multi-Tenant System Architecture

This document specifies the target multi-tenant system architecture of **UniVote**, outlining the structural transition from the prototype to a multi-organization voting and polling platform.

---

## 1. Architectural Vision & Scope

UniVote is an organizational voting platform serving diverse membership-based bodies:
- **Universities & Colleges**: Student Representative Council (SRC) ballots, faculty boards, course representative voting.
- **Academic Departments**: Departmental executive elections, committee polls.
- **Student Associations & Clubs**: Sports clubs, debate societies, student unions.
- **Companies & Corporate Boards**: Staff representatives, shareholder and board resolutions.
- **Professional Associations & Trade Unions**: Executive officer elections, constitution ratifications.

Each organization operates as an independent tenant within a shared, centralized infrastructure with strict data isolation.

```mermaid
graph TD
    Client["Client Applications<br>(React 19 Web SPA / Future iOS & Android)"] --> Gateway["API Gateway / FastAPI Backend"]
    
    subgraph "Central Platform Layer"
        Gateway --> AuthSvc["Universal Account & Auth Service<br>(Firebase Auth + JWT Claims)"]
        Gateway --> OrgSvc["Multi-Tenant Isolation & Context Binding"]
    end
    
    subgraph "Domain Engines"
        OrgSvc --> FormalElec["Formal Elections Engine<br>(FPTP, Multiple Positions, Approvals)"]
        OrgSvc --> QuickPolls["Quick Polls Engine<br>(Public / Member / Group Auditing)"]
        OrgSvc --> MemberSvc["Membership & Verification Engine<br>(Multi-Org Linking, Roster Cross-Match)"]
    end
    
    subgraph "Persistence Layer (PostgreSQL)"
        FormalElec --> CentralDB[("PostgreSQL Database<br>(Tenant-Scoped via organization_id)")]
        QuickPolls --> CentralDB
        MemberSvc --> CentralDB
    end
```

---

## 2. Multi-Tenant Architectural Topology

UniVote employs a **Shared Database, Shared Schema with Column-Level Tenant Isolation**:
- Every organization-scoped table contains an indexed foreign key: `organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE`.
- FastAPI route dependencies and SQLAlchemy query builders automatically bind and filter queries to the active tenant scope (`current_organization`).
- Tenant isolation is authoritatively enforced at the backend dependency and query layers.

### Logical Separation of Tenancy Boundaries:
1. **Platform Scope**: Platform Super Admins oversee platform uptime, organization creation, system-wide configuration, and global audit streams.
2. **Organization Scope**: Organization Admins configure membership groups, custom fields, verification rosters, Election Officials, and Poll Creators.
3. **Event Scope (Election / Poll)**: Scoped to specific elections or polls, governing ballot access, candidate nomination, voter eligibility, and result sign-off.

---

## 3. Core Subsystems & Interaction Patterns

```mermaid
sequenceDiagram
    autonumber
    actor User as User (Universal Account)
    participant Web as React Web SPA
    participant API as FastAPI Backend
    participant Tenant as Tenant Isolation Middleware
    participant Engine as Election / Poll Engine
    participant DB as PostgreSQL

    User->>Web: Selects Organization & Event
    Web->>API: HTTP Request + Bearer Token + X-Organization-ID
    API->>Tenant: Verify User Membership & Permissions for Org
    Tenant->>DB: Query organization_memberships where user_id & org_id
    alt Not Member / Suspended
        Tenant-->>Web: 403 Forbidden (Not an active member of this organization)
    else Active Member
        Tenant->>Engine: Forward request with bound Organization Context
        Engine->>DB: Execute query filtered by organization_id & event_id
        DB-->>Engine: Tenant-isolated data
        Engine-->>Web: Response payload
    end
```

---

## 4. Current Prototype vs. Target Architecture

| Component | Current Prototype Implementation | Target Multi-Tenant Architecture |
|---|---|---|
| **Tenancy** | Single-tenant (implicit single university context) | Multi-tenant (`organizations`, multi-org memberships) |
| **User Identity** | User account tied directly to a single `student_id` | Universal user account belonging to multiple organizations via `organization_memberships` |
| **Roles** | Static global enum (`STUDENT`, `ELECTION_OFFICIAL`, `SUPER_ADMIN`) | 6 Scoped Roles: Platform Super Admin, Org Admin, Election Official, Election Super Admin, Member/Voter, Poll Creator |
| **Voting Capabilities** | Draft departmental election configuration only | Two distinct modules: **Formal Elections** (multi-position, approval workflow) and **Quick Polls** (informal, lightweight) |
| **Ballot Security** | Basic database schema (no vote casting tables yet) | Cryptographic voter/ballot separation, audit logging, vote editing before close |
| **Clients** | React 19 + TypeScript (Vite) | Web SPA + Native iOS & Android apps consuming identical FastAPI REST APIs |
| **Hosting Strategy** | Neon / Supabase + Local FastAPI / Vite | Vercel (Frontend), Render (Backend), Managed PostgreSQL (Neon / Supabase / AWS RDS) |

---

## 5. Architectural Invariants

1. **Strict Data Isolation**: An authenticated request can never view or modify data outside its designated `organization_id` unless executed by a verified Platform Super Admin.
2. **Universal Identity**: A single email account represents a person across the entire UniVote ecosystem. User credentials belong to the platform, while memberships belong to organizations.
3. **Authoritative Backend Boundary**: Client applications (Web, iOS, Android) cannot declare or manipulate organizational roles. All permissions are evaluated server-side per request.
4. **Decoupled Verification vs. Eligibility**: Organization membership verification confirms identity within an institution; eligibility determines permission to vote in a specific election or poll.
