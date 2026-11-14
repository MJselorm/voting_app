# ROLES_AND_PERMISSIONS.md — Scoped Role & Authority Specification

This document specifies the six scoped roles in **UniVote**, defining their operational boundaries, authority matrices, and access enforcement rules.

---

## 1. Six Scoped Roles Overview

UniVote structures authority across three distinct scopes: **Platform**, **Organization**, and **Election**:

```mermaid
graph TD
    subgraph "Platform Scope"
        PSA["1. Platform Super Admin<br>(Full Platform Governance)"]
    end

    subgraph "Organization Scope"
        OA["2. Organization Admin<br>(Organization Operations & Staffing)"]
        PC["6. Poll Creator<br>(Informal Quick Polls)"]
        MEM["5. Member / Voter<br>(Participates in Ballots)"]
    end

    subgraph "Election Scope"
        ESA["4. Election Super Admin<br>(Final Result Approval & Certification)"]
        EO["3. Election Official<br>(Election Setup, Vetting, Oversight)"]
    end

    PSA -->|Appoints & Manages| OA
    OA -->|Appoints| PC
    OA -->|Appoints / Approves| EO
    OA -->|Appoints / Approves| ESA
    OA -->|Verifies & Manages| MEM
    EO -->|Manages Ballots for| MEM
    ESA -->|Certifies Results for| MEM
    PC -->|Publishes Polls for| MEM
```

---

## 2. Role Specification Matrix

| Role | Scope | Authority & Core Responsibilities | Appointment Mechanism |
|---|---|---|---|
| **1. Platform Super Admin** | Global / Platform | Oversees global infrastructure, reviews and approves new organizations, assigns initial Organization Admins, and audits cross-tenant activities. | Direct database provisioning or internal platform governance. |
| **2. Organization Admin** | Organization | Configures organizational branding, manages membership verification, uploads voter registers, assigns Election Officials, and grants Poll Creator permissions. | Appointed by Platform Super Admin (initial) or existing Org Admin. |
| **3. Election Official** | Specific Election / Org | Configures formal elections, sets up contested positions, vets candidate nominations, monitors live turnout, and conducts preliminary review of tallies. | Assigned by Organization Admin to specific election(s). |
| **4. Election Super Admin** | Specific Election / Org | Holds final certification authority. Reviews election audit trails, signs off on preliminary tallies, approves or rejects results, and certifies public release. | Assigned by Organization Admin or Institutional Returning Officer. |
| **5. Member / Voter** | Organization | Enrolled organizational member. Verifies identity against the institutional register, browses elections/polls, checks eligibility, and casts secret ballots. | Self-registration followed by institutional verification. |
| **6. Poll Creator** | Organization | Authorized member or staff member allowed to configure and publish lightweight informal Quick Polls (e.g. Best Lecturer, Club Awards). | Granted permission by Organization Admin. |

---

## 3. Disambiguation Rules

To eliminate role confusion in implementation and audit trails:

1. **Platform Super Admin vs. Election Super Admin**:
   - The **Platform Super Admin** oversees server infrastructure, system uptime, and tenant onboarding across the entire platform.
   - The **Election Super Admin** is an institutional authority (such as an Electoral Commissioner or Dean of Students) whose sole jurisdiction is giving final approval to election results within their organization.
2. **Organization Admin vs. Election Official**:
   - The **Organization Admin** manages institutional operations, voter registers, and member rosters.
   - The **Election Official** has operational oversight of an individual election, its candidates, and ballot setups.
3. **Members vs. Eligible Voters**:
   - A **Member** is a verified user belonging to an organization.
   - An **Eligible Voter** is a member who satisfies the specific criteria (department, cohort, level) established for a given ballot.

---

## 4. Authorization Enforcement

All permissions are authoritatively checked on the server using FastAPI dependency injection:
- `require_platform_admin`: Verifies `user.is_platform_super_admin == True`.
- `require_org_admin`: Verifies active membership with `role == 'ORGANIZATION_ADMIN'` for `current_organization_id`.
- `require_election_official`: Verifies assignment in `election_official_assignments` or Org Admin standing.
- `require_election_super_admin`: Verifies final result certification authority for the target election.
