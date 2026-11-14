# TASK_TRACKER.md — UniVote Multi-Tenant Feature Tracker

This document provides a high-level development progress tracker for the UniVote platform, distinguishing verified prototype capabilities from target multi-tenant features.

For the comprehensive, phased task checklist, see **[docs/planning/IMPLEMENTATION_TODO.md](docs/planning/IMPLEMENTATION_TODO.md)**.
For the repository gap analysis, see **[docs/planning/CURRENT_IMPLEMENTATION_STATUS.md](docs/planning/CURRENT_IMPLEMENTATION_STATUS.md)**.

---

## 1. Feature Status Summary

| Capability Area | Current Status | Description | Target Architecture Notes |
|---|---|---|---|
| **Universal Accounts & Auth** | `PARTIALLY IMPLEMENTED` | Firebase Email/Password & Google OAuth functional. | Needs decoupling from single `student_id` to allow joining multiple orgs. |
| **Multi-Tenancy Infrastructure** | `NOT STARTED` | Not in codebase. | Requires `organizations` and `organization_memberships` tables. |
| **Organization Management** | `NOT STARTED` | Not in codebase. | Platform Super Admin console & Organization Admin settings needed. |
| **Roster Ingestion (.csv, .xlsx)** | `IMPLEMENTED (PROTOTYPE)` | Spreadsheet parsing and dry-run preview functional. | Requires adding `organization_id` foreign key. |
| **Student Identity Verification** | `IMPLEMENTED (PROTOTYPE)` | Multi-factor name/email cross-matching functional. | Needs scoping to organization membership registers. |
| **Voting Eligibility Engine** | `PARTIALLY IMPLEMENTED` | 4-tier evaluation against criteria implemented. | Requires position-specific eligibility overrides. |
| **Formal Elections Wizard** | `IMPLEMENTED` | Multi-step setup wizard and position creation built. | Candidate nomination & vetting workflow needed. |
| **First-Past-The-Post Balloting**| `NOT STARTED` | Ballot casting endpoints not yet built. | Requires vote editing before close and duplicate prevention. |
| **Ballot Secrecy & Decoupling** | `NOT STARTED` | Not in codebase. | Requires decoupling voter participation logs from anonymous cast ballots. |
| **Quick Polls Module** | `NOT STARTED` | Not in codebase. | Informal polling engine for Public/Member/Group audiences needed. |
| **Multi-Tier Approvals** | `PARTIALLY IMPLEMENTED` | `ElectionApproval` model and UI built. | Needs final integration with Election Super Admin result certification. |
| **Election Audit Logging** | `IMPLEMENTED` | Immutable audit ledger functional (Migration 009). | Needs organization-level activity stream expansion. |
| **Mobile Applications** | `NOT STARTED` | Not in codebase. | iOS and Android client applications planned. |

---

## 2. Development Roadmap Milestones

- **Phase 1: Architecture Foundation** — Multi-tenancy schemas, organization data partitioning, scoped role models.
- **Phase 2: Universal Accounts & Membership** — Decoupled global registration, multi-org onboarding, membership verification.
- **Phase 3: Organization Management** — Platform Admin console, tenant approvals, Organization Admin settings.
- **Phase 4: Voter Eligibility Management** — Tenant-scoped roster uploads, duplicate detection, position overrides.
- **Phase 5: Formal Elections Engine** — Candidate vetting, FPTP ballot casting, vote editing before close, result approval.
- **Phase 6: Quick Polls Engine** — Lightweight informal polls, zero-roster member voting, public/group audiences.
- **Phase 7: Security & Governance** — Ballot secrecy, participation ledger decoupling, audit stream.
- **Phase 8: Mobile & Expansion** — Native iOS/Android apps, Student Information System (SIS) connectors.
