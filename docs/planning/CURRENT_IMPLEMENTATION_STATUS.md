# CURRENT_IMPLEMENTATION_STATUS.md — Repository Audit & Gap Analysis

This document records the exact state of the UniVote codebase, cataloging verified features, partial implementations, and architectural gaps between the current single-institution prototype and the target multi-tenant platform.

---

## 1. Verified Existing Functionality

The following capabilities are verified to exist in application code, database migrations, and automated test suites:

### Authentication & Token Verification
- **Firebase Authentication**: Client email/password registration, login, password recovery, and Google OAuth popup (`frontend/src/lib/firebase.ts`, `frontend/src/pages/LoginPage.tsx`).
- **Cryptographic Token Verification**: FastAPI `get_verified_firebase_token()` verifying Google public certificates via Firebase Admin SDK (`backend/app/core/firebase_admin.py`).
- **User Account Sync**: Automatic database user provisioning upon sign-in (`backend/app/api/auth.py`).

### Student Records & Roster Ingestion
- **Spreadsheet Parsing**: Python `csv` and `openpyxl` parser for `.csv` and `.xlsx` rosters (`backend/app/services/csv_importer.py`).
- **Dry-Run Import Preview**: Headers check, email validation, and duplicate/conflict detection (`backend/app/api/students.py`).
- **Batch Record Import**: Batch insertion and updating of students with import audit logging (`backend/app/models/student_import.py`).

### Verification & Eligibility
- **Identity Matching**: Whitespace-collapsed, case-insensitive comparison of student ID, full name, and email (`backend/app/services/identity.py`, `backend/app/services/student_verification.py`).
- **Eligibility Engine**: 4-tier check validating active status, verification status, and department criteria (`backend/app/services/eligibility.py`).

### Election Configuration & Governance
- **Election Modeling & Wizard**: Multi-step election setup wizard specifying title, department, dates, and eligibility rules (`backend/app/models/election.py`, `frontend/src/pages/ElectionWizardPage.tsx`).
- **Contested Position Modeling**: `ElectionPosition` supporting sort orders and winner counts.
- **Staff Assignment**: `ElectionOfficialAssignment` junction model assigning officials to elections.
- **Approval Pipeline & Audit Logging**: Multi-stage approval state tracking (`ElectionApproval`) and immutable change ledger (`ElectionAuditLog`, Migration `009`).
- **Database Rollup Metrics**: Super Admin live database statistics computed via single SQL `COUNT()` queries backed by partial indexes (`backend/app/api/auth.py`, Migration `007`).

---

## 2. Partially Implemented Functionality

- **Election Approval Workflow**: The backend schema and approval models exist, and the frontend `ApprovalsPage.tsx` interface is built, but the final promotion from `SUPER_ADMIN_FINAL_APPROVAL` to `APPROVED` currently lacks integration with certified post-election result publication.
- **Voter Eligibility Estimator**: Implemented for draft election criteria (`POST /api/elections/estimate-eligibility`), but currently queries the single-tenant `students` table rather than an organization-scoped roster.
- **Role-Aware Dashboards**: Three dashboard views (`STUDENT`, `ELECTION_OFFICIAL`, `SUPER_ADMIN`) exist, but roles are treated as global attributes rather than organization-scoped memberships.

---

## 3. Missing Functionality (Target Architecture)

The following components are defined in the new architecture but **do not yet exist in code**:

1. **Multi-Tenancy Infrastructure**:
   - No `organizations` table or model.
   - No `organization_memberships` table.
   - No tenant resolution middleware (`X-Organization-ID` context binding).
2. **Universal Membership Onboarding**:
   - No organization discovery, browsing, or multi-tenant joining workflows.
   - User registration is currently coupled to an optional global `student_id`.
3. **Quick Polls Module**:
   - Zero models, routers, services, or UI components exist for informal Quick Polls.
4. **Candidate Management**:
   - Contested positions exist as vacant offices; candidate application, document upload, and candidate vetting are not yet built.
5. **Ballot Casting & Secrecy**:
   - No tables exist for `cast_ballots` or `voter_participation_records`.
   - Vote casting, FPTP tallying, and vote editing before close are completely unwritten.
6. **Mobile Applications**:
   - No iOS or Android native clients exist.

---

## 4. Functionality Requiring Architectural Changes

| Existing Implementation | Current State | Required Architectural Change |
|---|---|---|
| **`User.role`** | Global enum (`STUDENT`, `ELECTION_OFFICIAL`, `SUPER_ADMIN`) | Transition to `users.is_platform_super_admin`, moving operational roles into `organization_memberships.role`. |
| **`User.student_id`** | Directly embedded on the global `users` table | Move `student_id` (institutional identifier) into `organization_memberships.member_identifier`. |
| **`students` Table** | Global flat table for a single university roster | Replace with or scope to `organization_voter_registers` with mandatory `organization_id`. |
| **`elections` Table** | Assumes single university context with a simple string `department` | Add foreign key `organization_id UUID NOT NULL REFERENCES organizations(id)`. |
| **Authorization Dependencies** | Dependencies check global `current_user.role` | Refactor dependencies to evaluate `(user_id, organization_id, election_id)` scopes. |

---

## 5. Areas Requiring Further Investigation

1. **Vote Anonymization & Re-Voting**: Establishing the exact cryptographic mechanism to allow voters to edit their choices before election close without linking their real identity to their candidate choice in database logs.
2. **Public Poll Fingerprinting**: Determining whether browser canvas fingerprinting or lightweight email OTP is preferable for unauthenticated `PUBLIC` Quick Polls.
