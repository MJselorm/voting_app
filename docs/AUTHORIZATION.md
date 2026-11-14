# AUTHORIZATION.md — Authorization & Role-Based Access Control

## 1. Overview

UniVote implements strict **Role-Based Access Control (RBAC)**. While the frontend uses roles to tailor the navigation interface, **all authorization decisions are authoritatively enforced on the backend**.

## 2. Roles & Permissions

The platform defines three roles in `UserRole` (`backend/app/models/user.py`):

| Role | Intended Audience | Permissions & Scope |
|---|---|---|
| **`STUDENT`** | Enrolled Students | Default self-registration role. Can view active elections, cast ballots, check voting eligibility, verify student identity, and edit personal profile. |
| **`ELECTION_OFFICIAL`** | Electoral Commission Staff | Can upload and manage student rosters, create and configure elections, manage contested positions, review candidate nominations, and record election approvals. |
| **`SUPER_ADMIN`** | University IT & Chief Returning Officer | Full administrative authority. Can promote/demote user roles, assign election officials, give final approvals on elections, view exact database totals, and inspect election audit logs. |

## 3. Backend Dependency Enforcement

FastAPI route handlers enforce permissions using dependency injection (`backend/app/auth/dependencies.py`):

```python
# 1. Any active user
@router.get("/me")
async def get_me(current_user: User = Depends(get_current_user)):
    ...

# 2. Election Official or Super Admin
@router.post("/students/import/preview")
async def preview_import(admin: User = Depends(require_election_official)):
    ...

# 3. Super Admin Only
@router.get("/dashboard-stats")
async def get_stats(admin: User = Depends(require_admin)):
    ...
```

## 4. Role Escalation Prevention

- Self-registration always sets `role = UserRole.STUDENT`.
- Profile updates via `PATCH /api/auth/me` explicitly exclude `role`, `is_active`, and `is_verified` fields.
- Role modifications can only be performed by a `SUPER_ADMIN` via `PATCH /api/admin/users/{user_id}/role` or `POST /api/admin/officials/assign`.
- Deactivated accounts (`is_active == False`) are rejected at the authentication layer (`403 Forbidden`).
