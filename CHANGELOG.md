# CHANGELOG.md — UniVote Version History

All notable changes to the UniVote project are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

### Planned
- Candidate nominations and vetting module (`POST /api/elections/{id}/candidates`).
- Candidate public manifesto profiles and campaign gallery.
- Electronic ballot retrieval and encrypted vote casting pipeline.
- One-vote-per-position rule enforcement with receipt tokens.
- Ballot edit capability prior to election closing time.
- Automated scheduled election lifecycle runner (`SCHEDULED` -> `LIVE` -> `ENDED`).
- Election results tallying, certification, and public publication module.
- Institutional notifications and in-app voting alerts.

---

## [0.3.0] - 2026-08-24

### Added
- Multi-step Election Configuration Wizard (`ElectionWizardPage.tsx`) for setting titles, dates, eligibility criteria, and contested positions.
- Contested positions management supporting single-winner and multi-winner offices (`ElectionPosition` model).
- Election Official Assignment system (`ElectionOfficialAssignment` model) enabling staff delegation.
- Multi-tier Election Approvals Pipeline (`ElectionApproval` model, `ApprovalsPage.tsx`).
- Full immutable election audit logging (`ElectionAuditLog` model, Migration `009`).
- Super Admin user and official management endpoints (`/api/admin/users`, `/api/admin/officials`).
- Real-time eligible voter estimation service (`/api/elections/estimate-eligibility`).
- Comprehensive automated test suites (`test_election_configuration.py`, `test_admin_management.py`).

### Changed
- Expanded `ElectionStatus` enum with `OFFICIAL_REVIEW`, `SUPER_ADMIN_FINAL_APPROVAL`, and `CANCELLED`.
- Updated backend routers to register election and administrative management endpoints.

---

## [0.2.0] - 2026-08-13

### Added
- Official student roster importer supporting `.csv` and `.xlsx` uploads with dry-run preview and conflict detection.
- Roster upload audit logging (`StudentImport` model, Migration `006`).
- Student identity verification against official records comparing student ID, normalized names, and emails.
- Dynamic voting eligibility engine checking account status, verification, and department rules.
- High-efficiency Super Admin live dashboard statistics endpoint (`GET /api/auth/admin/dashboard-stats`).
- Partial indexes on `users` and `students` for instant count aggregation (Migration `007`).
- Dedicated role-based UI dashboards for `STUDENT`, `ELECTION_OFFICIAL`, and `SUPER_ADMIN`.

### Fixed
- Idempotent schema recreation migrations (`005_recreate_core_tables`).
- Name normalization handling multi-space variations and case-insensitive matching.

---

## [0.1.0] - 2026-08-08

### Added
- Project foundation with FastAPI backend and React 19 + TypeScript + Vite frontend.
- Firebase Authentication integration (Email/Password and Google OAuth).
- Firebase Admin SDK token verification in FastAPI with `HTTPBearer` extraction.
- Relational schema foundation: `users` and `students` tables (Migration `001`).
- Initial route protection (`ProtectedRoute`, `PublicOnlyRoute`).
- Asynchronous database engine setup with PostgreSQL / Supabase / Neon.
