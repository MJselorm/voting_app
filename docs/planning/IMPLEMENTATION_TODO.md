# IMPLEMENTATION_TODO.md — Multi-Tenant Implementation Master Checklist

This document is the authoritative task tracker for transitioning UniVote from the single-institution prototype to the target multi-tenant platform.

**Status Labels:**
- `NOT STARTED`: Architectural plan established; code not written.
- `PARTIALLY IMPLEMENTED`: Partial backend model, schema, or UI exists; requires enhancement.
- `IMPLEMENTED`: Functionality verified in codebase, migrations, and test suite.
- `NEEDS REVIEW`: Implemented in prototype; requires architectural refactoring to align with multi-tenancy.
- `BLOCKED`: Development dependent on prior foundational phase completion.

---

## Phase 1: Architecture Foundation

- [x] **Audit existing backend and frontend architecture**
  - **Status**: `IMPLEMENTED`
  - **Relevant Files**: `backend/app/main.py`, `frontend/src/App.tsx`, `docs/architecture/`
  - **Outcome**: Complete inspection performed; current single-institution constraints documented.
- [x] **Review existing database schema**
  - **Status**: `IMPLEMENTED`
  - **Relevant Files**: `backend/app/models/`, `backend/migrations/versions/`
  - **Outcome**: Models evaluated (users, students, elections, positions, approvals, audit logs).
- [ ] **Design multi-tenant organization relationships**
  - **Status**: `NOT STARTED`
  - **Dependencies**: None.
  - **Expected Outcome**: Relational design for `organizations` and `organization_memberships` tables with foreign key cascades.
  - **Implementation Notes**: Will introduce `organization_id` to election, roster, and audit tables.
- [ ] **Design scoped role and permission architecture**
  - **Status**: `NOT STARTED`
  - **Dependencies**: Organization schema design.
  - **Expected Outcome**: Pydantic and SQLAlchemy models reflecting 6 scoped roles (Platform Super Admin, Org Admin, Election Official, Election Super Admin, Member, Poll Creator).
- [ ] **Define organization isolation requirements**
  - **Status**: `NOT STARTED`
  - **Dependencies**: Scoped role design.
  - **Expected Outcome**: FastAPI dependency `get_current_org_context` reading `X-Organization-ID` and binding query scope.
- [ ] **Identify required database migrations**
  - **Status**: `NOT STARTED`
  - **Dependencies**: Relational schema design.
  - **Expected Outcome**: Plan for non-breaking Alembic migrations adding `organizations`, `organization_memberships`, and tenant foreign keys.
- [ ] **Document API changes required**
  - **Status**: `NOT STARTED`
  - **Dependencies**: Tenant isolation design.
  - **Expected Outcome**: REST path conventions updated to `/api/orgs/{org_id}/...`.

---

## Phase 2: Universal Accounts & Membership

- [x] **Review existing authentication implementation**
  - **Status**: `IMPLEMENTED`
  - **Relevant Files**: `backend/app/core/firebase_admin.py`, `backend/app/auth/dependencies.py`
  - **Outcome**: Firebase ID token verification verified working cleanly.
- [ ] **Support universal email-based registration**
  - **Status**: `NEEDS REVIEW`
  - **Relevant Files**: `backend/app/api/auth.py`, `frontend/src/pages/RegisterPage.tsx`
  - **Expected Outcome**: Decouple `student_id` from registration payload so any valid email can register globally.
- [ ] **Design organization joining workflow**
  - **Status**: `NOT STARTED`
  - **Dependencies**: Universal registration.
  - **Expected Outcome**: Endpoint `POST /api/orgs/{org_id}/join` allowing registered users to request membership.
- [ ] **Design membership verification**
  - **Status**: `PARTIALLY IMPLEMENTED`
  - **Relevant Files**: `backend/app/services/student_verification.py`, `backend/app/services/identity.py`
  - **Expected Outcome**: Adapt existing identity comparison logic to cross-check membership against the specific organization's roster.
- [ ] **Implement membership statuses**
  - **Status**: `NOT STARTED`
  - **Dependencies**: Membership schema.
  - **Expected Outcome**: Support `PENDING_VERIFICATION`, `ACTIVE`, `MANUAL_REVIEW`, `SUSPENDED`, `ALUMNI_INACTIVE`.
- [ ] **Support multiple organization memberships**
  - **Status**: `NOT STARTED`
  - **Dependencies**: Membership statuses.
  - **Expected Outcome**: User can hold active memberships in multiple organizations concurrently.
- [ ] **Separate account roles from organization roles**
  - **Status**: `NOT STARTED`
  - **Dependencies**: Membership architecture.
  - **Expected Outcome**: `users.role` becomes `is_platform_super_admin`, while operational roles reside in `organization_memberships.role`.

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

## Phase 4: Voter Eligibility Management

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

## Phase 7: Security & Governance

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

## Phase 8: Mobile Applications & Expansion

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
