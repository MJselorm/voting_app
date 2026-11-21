# IMPLEMENTATION_TODO.md — Phased Implementation Master Checklist

This document is the authoritative task tracker for transitioning UniVote from the single-institution prototype to the target multi-tenant platform.

**Status Labels:**
- `NOT STARTED`: No working implementation exists.
- `PARTIALLY IMPLEMENTED`: Some functionality exists but is incomplete.
- `IMPLEMENTED`: Verified through code, migration/schema, integration, and relevant tests.
- `NEEDS REVIEW`: Implementation exists but has architectural, security, or correctness concerns.
- `BLOCKED`: Verification cannot proceed because of an identified dependency or environment limitation.

---

## Phase 1: Architecture and Multi-Tenancy Foundation

- [] **Audit existing backend and frontend architecture**
  - **Status**: `PARTIALLY IMPLEMENTED`
  - **Relevant Files**: `backend/app/main.py`, `frontend/src/App.tsx`, `docs/SYSTEM_ARCHITECTURE.md`
  - **Outcome**: The authentication-only FastAPI and React foundations are implemented and tested. Organization and election domain implementations are outside this stage and remain to be built or reconnected.
- [] **Review existing database schema**
  - **Status**: `PARTIALLY IMPLEMENTED`
  - **Relevant Files**: `backend/app/models/`, `backend/migrations/versions/`
  - **Outcome**: The stage 1 `users` SQLAlchemy model and Alembic migration are implemented. The wider organization/election schema remains out of scope and has not been verified against Neon.
- [] **Design multi-tenant organization relationships**
  - **Status**: `NOT STARTED`
  - **Dependencies**: None.
  - **Expected Outcome**: Relational design for `organizations` and `organization_memberships` tables with foreign key cascades.
  - **Implementation Notes**: This task is intentionally outside the current authentication foundation. No `organizations` or `organization_memberships` tables were added.
- [x] **Design scoped role and permission architecture**
  - **Status**: `NEEDS REVIEW`
  - **Dependencies**: Organization schema design.
  - **Outcome**: Tenant roles use active membership checks; legacy global operational-role mutation is retired. API integration and role-isolation tests still require a test database.
- [x] **Define organization isolation requirements**
  - **Status**: `NEEDS REVIEW`
  - **Dependencies**: Scoped role design.
  - **Outcome**: `X-Organization-ID` is required and validated as an active organization; no fallback is used. Service and API isolation remain unverified end to end.
- [] **Identify required database migrations**
  - **Status**: `BLOCKED`
  - **Dependencies**: Relational schema design.
  - **Outcome**: Migrations 010–012 form a linear source revision chain and offline SQL renders. No migration has been applied to a database.
- [] **Document API changes required**
  - **Status**: `PARTIALLY IMPLEMENTED`
  - **Dependencies**: Tenant isolation design.
  - **Outcome**: Organization endpoints and a browser discovery/join/verify route are present; API and browser integration tests remain blocked.

---

## Phase 2: Universal Accounts and Organization Membership

- [] **Review existing authentication implementation**
  - **Status**: `IMPLEMENTED`
  - **Relevant Files**: `backend/app/auth/firebase.py`, `backend/app/auth/dependencies.py`
  - **Outcome**: Firebase Admin centralized initialization, bearer-token verification, signature/expiry handling, revoked-token checks, and server-side email-verification enforcement are implemented. Live Firebase credentials and real-token lifecycle testing remain outstanding.
- [] **Support universal email-based registration**
  - **Status**: `PARTIALLY IMPLEMENTED`
  - **Relevant Files**: `backend/app/api/routes/auth.py`, `frontend/src/pages/RegisterPage.tsx`
  - **Outcome**: The frontend supports full-name, email, password, confirmation, Firebase email verification, and account synchronization without a student ID. Firebase account creation and email delivery require live project credentials and were not exercised.
- [] **Design organization joining workflow**
  - **Status**: `IMPLEMENTED`
  - **Relevant Files**: `backend/app/services/memberships.py`, `backend/app/services/membership_workflows.py`, `backend/app/api/routes/organizations.py`
  - **Outcome**: Policy-aware approval requests, direct joining, invitation acceptance, membership status, and admin review are covered by API tests. Voter eligibility remains out of scope.
- [] **Design membership verification**
  - **Status**: `IMPLEMENTED`
  - **Relevant Files**: `backend/app/services/memberships.py`, `backend/app/services/membership_workflows.py`
  - **Outcome**: Verified Firebase email-domain matching or explicit manual organisation-admin review; no submitted identity text is treated as a verified roster record.
- [] **Implement membership statuses**
  - **Status**: `IMPLEMENTED`
  - **Relevant Files**: `backend/app/models/organization.py`, `backend/app/services/memberships.py`, `backend/app/services/membership_workflows.py`
  - **Outcome**: Active memberships, pending/approved/rejected requests, and pending/verified/rejected/cancelled verification records have guarded, audited transitions. Migration `0006_configurable_membership` passed isolated SQLite validation but has not been applied to Neon.
- [] **Support multiple organization memberships**
  - **Status**: `IMPLEMENTED`
  - **Dependencies**: Membership statuses.
  - **Outcome**: Membership uniqueness is scoped to `(organization_id, user_id)`; a user can hold memberships in multiple organisations.
- [] **Separate account roles from organization roles**
  - **Status**: `IMPLEMENTED`
  - **Dependencies**: Membership architecture.
  - **Outcome**: Platform Super Admin status does not bypass organisation owner/admin checks. API tests cover this separation.

---

## Phase 3: Organization Management

- [ ] **Platform Super Admin dashboard**
  - **Status**: `NOT STARTED`
  - **Dependencies**: Scoped role model.
  - **Expected Outcome**: Dedicated portal for global tenant oversight, platform metrics, and system audits.
- [ ] **Organization creation and approval**
  - **Status**: `NOT STARTED`
  - **Dependencies**: Organization schema.
  - **Expected Outcome**: Workflow for organization registration, review, and approval by Platform Super Admin.
- [ ] **Initial Organization Admin assignment**
  - **Status**: `NOT STARTED`
  - **Dependencies**: Organization approval.
  - **Expected Outcome**: Assigning primary administrator credentials during tenant activation.
- [ ] **Organization settings & branding**
  - **Status**: `NOT STARTED`
  - **Dependencies**: Org Admin onboarding.
  - **Expected Outcome**: Tenant configuration (logos, primary colors, custom metadata).
- [ ] **Department and group management**
  - **Status**: `NOT STARTED`
  - **Dependencies**: Org Admin dashboard.
  - **Expected Outcome**: Management of faculties, departments, and cohort groups within the organization.
- [ ] **Organization Admin delegation tools**
  - **Status**: `NOT STARTED`
  - **Dependencies**: Org Admin dashboard.
  - **Expected Outcome**: Appointing Election Officials and granting Poll Creator privileges.

---

## Phase 4: Voter Eligibility and Register Management

- [x] **CSV voter imports**
  - **Status**: `NEEDS REVIEW`
  - **Relevant Files**: `backend/app/services/csv_importer.py`
  - **Implementation Notes**: Currently imports into single-tenant `students` table; must bind to `organization_id`.
- [x] **XLSX voter imports**
  - **Status**: `NEEDS REVIEW`
  - **Relevant Files**: `backend/app/services/csv_importer.py`
  - **Implementation Notes**: Verified working via `openpyxl`; needs tenant scoping.
- [x] **Import preview & validation**
  - **Status**: `IMPLEMENTED`
  - **Relevant Files**: `backend/app/api/students.py`, `backend/app/services/csv_importer.py`
  - **Outcome**: Dry-run preview flags missing headers and syntax errors.
- [x] **Duplicate detection**
  - **Status**: `IMPLEMENTED`
  - **Relevant Files**: `backend/app/services/csv_importer.py`
  - **Outcome**: Identifies existing records and prompts for update vs. skip strategy.
- [x] **Import history & audit logging**
  - **Status**: `NEEDS REVIEW`
  - **Relevant Files**: `backend/app/models/student_import.py`
  - **Implementation Notes**: Tracks file imports; needs `organization_id` foreign key.
- [ ] **Voter group management**
  - **Status**: `NOT STARTED`
  - **Dependencies**: Roster ingestion.
  - **Expected Outcome**: Grouping imported members into specific voter cohorts.
- [x] **Election-specific eligibility evaluation**
  - **Status**: `PARTIALLY IMPLEMENTED`
  - **Relevant Files**: `backend/app/services/eligibility.py`, `backend/app/models/election.py`
  - **Outcome**: JSONB criteria matching implemented; needs tenant scope binding.
- [ ] **Position-specific eligibility overrides**
  - **Status**: `NOT STARTED`
  - **Dependencies**: Election eligibility engine.
  - **Expected Outcome**: Allowing specific contested offices to restrict voter eligibility beyond the election-wide criteria.

---

## Phase 5: Formal Elections

- [x] **Election creation & configuration**
  - **Status**: `IMPLEMENTED`
  - **Relevant Files**: `backend/app/models/election.py`, `backend/app/api/elections.py`, `frontend/src/pages/ElectionWizardPage.tsx`
  - **Outcome**: Complete wizard for dates, department, type, and criteria.
- [x] **Multiple positions per election**
  - **Status**: `IMPLEMENTED`
  - **Relevant Files**: `backend/app/models/election.py` (`ElectionPosition`)
  - **Outcome**: Positions support display ordering and `number_of_winners`.
- [ ] **Candidate nomination & management**
  - **Status**: `NOT STARTED`
  - **Dependencies**: Contested positions.
  - **Expected Outcome**: Candidate filing, document upload, and official vetting workflows.
- [x] **Election Official assignment**
  - **Status**: `IMPLEMENTED`
  - **Relevant Files**: `backend/app/models/election.py` (`ElectionOfficialAssignment`)
  - **Outcome**: Staff assigned to specific elections with historical retention.
- [ ] **First-Past-The-Post (FPTP) voting execution**
  - **Status**: `NOT STARTED`
  - **Dependencies**: Candidate management.
  - **Expected Outcome**: Ballot casting endpoint enforcing one vote per position and optional blank votes.
- [ ] **Vote editing before election closure**
  - **Status**: `NOT STARTED`
  - **Dependencies**: FPTP voting.
  - **Expected Outcome**: Voters can re-submit and adjust selections while status is `LIVE`.
- [ ] **Duplicate vote prevention**
  - **Status**: `NOT STARTED`
  - **Dependencies**: FPTP voting.
  - **Expected Outcome**: Database constraints preventing multiple active ballots per voter.
- [ ] **Election closing automation**
  - **Status**: `NOT STARTED`
  - **Dependencies**: Election lifecycle.
  - **Expected Outcome**: Scheduled worker transitioning election status to `ENDED` upon reaching `end_at`.
- [ ] **Result counting & tallying engine**
  - **Status**: `NOT STARTED`
  - **Dependencies**: Election closing.
  - **Expected Outcome**: High-performance SQL aggregation tallying votes per candidate.
- [x] **Result review & approval pipeline**
  - **Status**: `PARTIALLY IMPLEMENTED`
  - **Relevant Files**: `backend/app/models/election.py` (`ElectionApproval`), `frontend/src/pages/ApprovalsPage.tsx`
  - **Outcome**: Approval models and UI exist; needs integration with final certified result release.
- [ ] **Result publication & public release**
  - **Status**: `NOT STARTED`
  - **Dependencies**: Result certification.
  - **Expected Outcome**: Public endpoints exposing certified winner tallies and turnout statistics.

---

## Phase 6: Quick Polls

- [ ] **Poll creation engine**
  - **Status**: `NOT STARTED`
  - **Dependencies**: Poll Creator role permissions.
  - **Expected Outcome**: Models and APIs for creating informal single-question polls.
- [ ] **Nominee and option management**
  - **Status**: `NOT STARTED`
  - **Dependencies**: Poll creation.
  - **Expected Outcome**: Supporting structured voting options or rich candidate/nominee cards.
- [ ] **Public audience targeting**
  - **Status**: `NOT STARTED`
  - **Dependencies**: Poll engine.
  - **Expected Outcome**: Allowing unauthenticated participation with anti-bot fingerprinting.
- [ ] **Organization-member audience targeting**
  - **Status**: `NOT STARTED`
  - **Dependencies**: Membership engine.
  - **Expected Outcome**: Restricting poll participation to verified active organization members.
- [ ] **Restricted voter group targeting**
  - **Status**: `NOT STARTED`
  - **Dependencies**: Voter groups.
  - **Expected Outcome**: Restricting polls to specific academic levels or departments.
- [ ] **Poll scheduling & automatic closure**
  - **Status**: `NOT STARTED`
  - **Dependencies**: Poll engine.
  - **Expected Outcome**: Automatic start and expiration time handling.
- [ ] **Duplicate participation prevention**
  - **Status**: `NOT STARTED`
  - **Dependencies**: Poll voting.
  - **Expected Outcome**: Tracking member participation to prevent multi-voting.
- [ ] **Automatic live / final results**
  - **Status**: `NOT STARTED`
  - **Dependencies**: Poll closing.
  - **Expected Outcome**: Real-time or instant post-closure display of poll outcomes without approval gates.

---

## Phase 7: Ballot Security and Governance

- [ ] **Organization data isolation enforcement**
  - **Status**: `NOT STARTED`
  - **Dependencies**: Phase 1 & 2.
  - **Expected Outcome**: Server-side filtering preventing cross-tenant data visibility.
- [ ] **Scoped authorization dependencies**
  - **Status**: `NOT STARTED`
  - **Dependencies**: Scoped roles.
  - **Expected Outcome**: Refactored FastAPI dependencies verifying organization and election-level rights.
- [ ] **Ballot secrecy architecture**
  - **Status**: `NOT STARTED`
  - **Dependencies**: Phase 5.
  - **Expected Outcome**: Decoupling voter participation records from secret cast ballots.
- [x] **Election audit logging**
  - **Status**: `IMPLEMENTED`
  - **Relevant Files**: `backend/app/models/election.py` (`ElectionAuditLog`), Migration `009`
  - **Outcome**: Immutable audit ledger tracks election configuration and approval changes.
- [ ] **Platform-wide administrative activity tracking**
  - **Status**: `NOT STARTED`
  - **Dependencies**: Organization management.
  - **Expected Outcome**: Audit stream capturing organization onboarding, status changes, and staff delegations.
- [ ] **Security testing & vulnerability audits**
  - **Status**: `NOT STARTED`
  - **Dependencies**: Voting execution.
  - **Expected Outcome**: Automated tests verifying tenant boundaries and ballot confidentiality under concurrent load.

---

## Phase 8: Mobile Applications and Future Integrations

- [ ] **Android application development**
  - **Status**: `NOT STARTED`
  - **Dependencies**: Core REST APIs.
  - **Expected Outcome**: Native / cross-platform Android mobile app consuming FastAPI endpoints.
- [ ] **iOS application development**
  - **Status**: `NOT STARTED`
  - **Dependencies**: Core REST APIs.
  - **Expected Outcome**: Native / cross-platform iOS mobile app consuming FastAPI endpoints.
- [ ] **Mobile API optimization**
  - **Status**: `NOT STARTED`
  - **Dependencies**: Mobile clients.
  - **Expected Outcome**: Push notifications, lightweight mobile payloads, biometric login support.
- [ ] **Institutional database integrations (SIS)**
  - **Status**: `NOT STARTED`
  - **Dependencies**: Voter eligibility engine.
  - **Expected Outcome**: Automated connectors to campus systems (Banner, PeopleSoft, Canvas).
- [ ] **Advanced voting methods**
  - **Status**: `NOT STARTED`
  - **Dependencies**: Formal election engine.
  - **Expected Outcome**: Ranked-Choice Voting (RCV) and Single Transferable Vote (STV) support.
- [ ] **End-to-End voter verifiability**
  - **Status**: `NOT STARTED`
  - **Dependencies**: Ballot security.
  - **Expected Outcome**: Zero-knowledge ballot receipt validation allowing voters to independently verify vote inclusion.
