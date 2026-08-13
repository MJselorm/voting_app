# UniVote — Current Implementation Status

Last updated: August 13, 2026

## Working now

### Authentication and identity

- Firebase email/password login, Google login, email verification, logout, and password reset.
- FastAPI verifies Firebase ID tokens and loads the matching PostgreSQL user account.
- New app accounts are created as `STUDENT`; roles are not accepted from the frontend.
- Users can update their profile details. Student identity changes require verification again.
- Student verification compares the account with an imported official student record.

### Role-based application UI

| Role | Dashboard | Access |
|---|---|---|
| `STUDENT` | `/dashboard` | Student voting interface and profile |
| `ELECTION_OFFICIAL` | `/official/dashboard` | Election-management workspace and student records |
| `SUPER_ADMIN` | `/admin/dashboard` | Full administration workspace and student records |

- Navigation and profile sidebars reflect the current user role.
- Unauthorized frontend routes redirect to the correct role dashboard.
- Backend authorization remains mandatory: frontend checks are not security controls.
- Super Admin navigation scrolls independently so its Logout button remains visible.

### Student records

- Election Officials and Super Admins can preview and import CSV/XLSX official student records.
- Import preview identifies valid, new, existing, and invalid records before confirmation.
- Staff can choose to update or skip existing records.
- The Student Records page is embedded in the staff dashboard layout.
- Student-record administration API routes are protected for Election Officials and Super Admins.

### Super Admin dashboard statistics

The Super Admin dashboard loads these live PostgreSQL/Supabase totals:

- Uploaded Student Records
- Registered Users
- Registered Voters
- Eligible to Vote

The API endpoint is `GET /api/auth/admin/dashboard-stats` and is Super-Admin-only.

- Counts are calculated with exact database `COUNT()` queries.
- All counts are returned in one API response and one SQL execution.
- Frontend deduplicates simultaneous in-flight stats requests, preventing React development-mode duplicate calls without caching stale data.
- Migration `007_dashboard_stats_indexes` adds indexes for common dashboard count filters.

## Not implemented yet

These areas currently use placeholder screens or dashboard mock values and should not be treated as completed functionality:

- Election creation, publication, approval, and lifecycle management
- Candidate creation and nomination workflow
- Ballot casting and vote receipts
- Vote storage, tallying, and live/final results
- User/official role-management workflows
- Notifications, departments, approvals, audit-log, and settings modules

## Database migrations

Run the latest migrations after configuring `backend/.env`:

```bash
cd backend
alembic upgrade head
```

The current migration head is `007_dashboard_stats_indexes`.

## Verification commands

```bash
cd backend
python -m compileall -q app

cd ../frontend
npm run build
```

## Security boundaries

- Firebase owns credentials; PostgreSQL stores no passwords.
- FastAPI verifies the Firebase token before loading a user.
- `require_election_official` protects student-record management endpoints.
- `require_admin` protects Super Admin statistics and admin-only backend operations.
- Do not rely on a browser route, sidebar visibility, or a client-provided role to authorize a request.
