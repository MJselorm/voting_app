# DATABASE.md — Database Architecture, Connection & Migration Guide

## 1. Overview

UniVote uses **PostgreSQL** hosted on **Neon Serverless** (compatible with Supabase), managed with **SQLAlchemy 2.0 (AsyncIO)** and **Alembic**.

## 2. Connection Architecture

### 2.1 Connection URL Formatting (`backend/app/core/config.py`)
- Standard connection URLs provide a `postgresql://` scheme with libpq query arguments (`sslmode=require`, `channel_binding=require`).
- For SQLAlchemy async execution, `async_database_url` converts the scheme to `postgresql+asyncpg` and removes incompatible libpq query flags:
  ```python
  @property
  def async_database_url(self) -> str:
      parts = urlsplit(self.DATABASE_URL)
      if parts.scheme == "postgresql":
          query = urlencode(
              [(k, v) for k, v in parse_qsl(parts.query, keep_blank_values=True)
               if k not in {"channel_binding", "sslmode"}]
          )
          return urlunsplit(("postgresql+asyncpg", parts.netloc, parts.path, query, parts.fragment))
      return self.DATABASE_URL
  ```

### 2.2 Connection Pooling (`backend/app/database/session.py`)
- Engine arguments configure TLS (`connect_args={"ssl": True}`).
- `pool_pre_ping=True` detects stale or severed serverless connections.
- `pool_size=5`, `max_overflow=5`, `pool_recycle=1800`.

## 3. Migration History (Alembic)

Migrations reside in `backend/migrations/versions/`:

| Revision | File | Description |
|---|---|---|
| `001_initial` | `001_initial_create_users_and_students_tables.py` | Initial creation of `users` and `students` tables and `userrole` enum. |
| `002_verification` | `002_add_verification_fields.py` | Adds `is_verified` and `verified_at` to `users`. |
| `003_recreate_users` | `003_recreate_users_table.py` | Repairs users table definition. |
| `004_student_status` | `004_add_student_status.py` | Adds `status` column to `students`. |
| `005_recreate_core` | `005_recreate_users_and_students_tables.py` | Idempotent table creation script. |
| `006_student_import` | `006_student_import_audit.py` | Creates `student_imports` audit table. |
| `007_stats_indexes` | `007_dashboard_stats_indexes.py` | Creates partial indexes for dashboard counting queries. |
| `008_election_cfg` | `008_election_creation_and_configuration.py` | Creates `elections`, `election_positions`, `election_official_assignments`, `election_approvals`, and `election_audit_logs`. |
| `009_ensure_audit` | `009_ensure_election_audit_logs.py` | Ensures enum values (`OFFICIAL_REVIEW`, `SUPER_ADMIN_FINAL_APPROVAL`) and audit log indexes. |

## 4. Running Migrations

To apply pending migrations:
```bash
cd backend
alembic upgrade head
```
