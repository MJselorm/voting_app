# DASHBOARDS.md — Role-Based Dashboards & Real-Time Metrics

## 1. Overview

UniVote tailors its user interface dynamically based on user roles (`STUDENT`, `ELECTION_OFFICIAL`, `SUPER_ADMIN`), ensuring optimal task clarity and operational separation.

## 2. Dashboard Layouts

| Role | Frontend Route | Key Navigation Items | Primary Tasks |
|---|---|---|---|
| **`STUDENT`** | `/dashboard` | Elections, My Votes, Notifications, Profile | View ballots, verify student identity, cast votes. |
| **`ELECTION_OFFICIAL`** | `/official/dashboard` | Elections, Student Records, Candidates, Results, Profile | Upload rosters, create elections, review candidates. |
| **`SUPER_ADMIN`** | `/admin/dashboard` | Elections, Student Records, Users, Officials, Approvals, Departments, Results, Audit Logs, Settings, Profile | Full governance, role promotion, final election approvals, audit trail inspection. |

## 3. High-Performance Super Admin Metrics

The Super Admin dashboard loads live database counts via `GET /api/auth/admin/dashboard-stats`.

### Response Payload:
```json
{
  "uploaded_student_records": 1250,
  "registered_users": 82,
  "registered_voters": 74,
  "eligible_voters": 61,
  "verified_voters": 59
}
```

### Database Optimization:
1. **Single SQL Query**: All counts are executed in one unified SQL statement using `COUNT()` expressions, eliminating network roundtrips.
2. **Partial Index Support** (Migration `007_dashboard_stats_indexes`):
   - `ix_users_dashboard_registered_voters` on `(id)` `WHERE role = 'STUDENT' AND is_active = TRUE`.
   - `ix_users_dashboard_verified_voters` on `(student_id)` `WHERE role = 'STUDENT' AND is_active = TRUE AND is_verified = TRUE`.
   - `ix_students_dashboard_eligibility` on `(status, lower(department), student_id)`.
3. **Frontend Deduplication**: In `RoleDashboardPage.tsx`, simultaneous in-flight statistic requests are deduplicated, avoiding React 19 double-invoke queries during development without caching stale data.
