# DEVELOPMENT_PHASES.md — Phased Implementation Strategy

## 1. Overview

This document defines the transition strategy to upgrade UniVote into a multi-tenant platform without disrupting existing prototype workflows or causing database downtime.

---

## 2. Phased Rollout Sequence

```mermaid
graph TD
    P1["Phase 1: Architecture & Data Foundation<br>(Multi-tenant schemas, organizations, memberships)"] --> P2["Phase 2: Universal Accounts & Membership<br>(Multi-org joining, decoupled profiles)"]
    P2 --> P3["Phase 3: Tenant Governance & Scoped Roles<br>(Platform Admin console, Org Admin settings)"]
    P3 --> P4["Phase 4: Scoped Eligibility & Roster Ingestion<br>(Org-scoped voter registers, dynamic overrides)"]
    P4 --> P5["Phase 5: Formal Elections Engine<br>(Candidate vetting, FPTP balloting, vote editing)"]
    P5 --> P6["Phase 6: Quick Polls Engine<br>(Informal polls, zero-roster member voting)"]
    P6 --> P7["Phase 7: Security Hardening & Secrecy<br>(Ballot decoupling, audit streams)"]
    P7 --> P8["Phase 8: Mobile Clients & Institutional SIS Connectors<br>(iOS, Android, Banner/Canvas sync)"]
```

---

## 3. Detailed Phase Objectives

### Phase 1: Architecture & Data Foundation
- **Milestone**: Non-breaking database migration introducing `organizations` and `organization_memberships`.
- **Backward Compatibility**: Migrate existing users and elections into a default institutional tenant (e.g., "Default University") to preserve current data.

### Phase 2: Universal Accounts & Membership
- **Milestone**: Users can register with standard emails, browse organizations, and submit institutional identifiers.
- **Verification**: Refactor identity verification to cross-match memberships against organization-specific rosters.

### Phase 3: Tenant Governance & Scoped Roles
- **Milestone**: Platform Super Admin console for tenant approvals and Organization Admin delegation tools for Election Officials and Poll Creators.

### Phase 4: Scoped Eligibility & Roster Ingestion
- **Milestone**: Ingestion of rosters scoped strictly by `organization_id`, backed by position-level eligibility overrides.

### Phase 5: Formal Elections Engine
- **Milestone**: End-to-end voting pipeline with candidate nomination, FPTP voting, vote editing before close, and final Election Super Admin certification.

### Phase 6: Quick Polls Engine
- **Milestone**: High-engagement informal polling module for public, member, and restricted group audiences.

### Phase 7: Ballot Security & Secrecy Hardening
- **Milestone**: Physical and logical decoupling of voter participation logs from anonymous cast ballots.

### Phase 8: Mobile Clients & SIS Connectors
- **Milestone**: Cross-platform iOS/Android apps consuming FastAPI endpoints, alongside direct API connectors to university SIS systems.
