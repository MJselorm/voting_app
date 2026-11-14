# BACKEND.md — Backend Architecture & Service Guide

## 1. Overview

The UniVote backend is an asynchronous REST API built with **FastAPI**, **SQLAlchemy 2.0 (AsyncIO)**, and **Pydantic v2**. It enforces authentication, role-based authorization, identity verification, roster ingestion, and election lifecycle management.

## 2. Directory Structure

```
backend/
├── app/
│   ├── api/          # Route handlers (auth, admin, elections, eligibility, students)
│   ├── auth/         # Token verification and authorization dependencies
│   ├── core/         # Settings (config.py) and Firebase Admin SDK setup
│   ├── database/     # Engine, AsyncSession, and Base declarative model
│   ├── models/       # SQLAlchemy ORM models
│   ├── schemas/      # Pydantic v2 validation and serialization schemas
│   ├── services/     # Pure business logic and database queries
│   └── main.py       # Application initialization, lifespan, CORS, and router mounts
├── migrations/       # Alembic migration scripts
└── tests/            # Pytest automated test suites
```

## 3. Application Lifecycle (`main.py`)

- **Lifespan Context Manager**:
  ```python
  @asynccontextmanager
  async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
      logger.info("Starting University Voting API (env=%s)", settings.APP_ENV)
      initialize_firebase()
      yield
      logger.info("University Voting API shutting down")
  ```
- **Firebase Initialization**: `initialize_firebase()` is called exactly once at startup.
- **CORS Configuration**: Controlled via `settings.cors_origins` (parsed from `ALLOWED_ORIGINS`).

## 4. Database Access Layer (`database/`)

- **Async Engine**: Configured in `session.py` using `create_async_engine(settings.async_database_url, connect_args={"ssl": True})`.
- **Session Factory**: `AsyncSessionLocal` generates isolated `AsyncSession` instances.
- **Dependency**: `get_db()` yields sessions with automatic commit on success and rollback on exceptions:
  ```python
  async def get_db() -> AsyncGenerator[AsyncSession, None]:
      async with AsyncSessionLocal() as session:
          try:
              yield session
              await session.commit()
          except Exception:
              await session.rollback()
              raise
          finally:
              await session.close()
  ```

## 5. Service Architecture (`services/`)

To keep endpoint handlers lightweight, all database queries and business logic reside in `services/`:

- **`identity.py`**: Name normalization, case-insensitive comparison, and email domain validation.
- **`student_verification.py`**: Multi-factor matching engine linking application accounts to official student records.
- **`eligibility.py`**: Voter eligibility rules engine verifying academic criteria (department, level, class, status).
- **`csv_importer.py`**: Parser and validation engine for `.csv` and `.xlsx` roster files.
- **`elections.py`**: Election creation, updates, status machine transitions, approvals, eligibility estimation, and audit logging.
- **`admin.py`**: User search, role updates, official assignments, and approval queue rollups.

## 6. Error Handling & Security

- Endpoints raise `fastapi.HTTPException` with precise status codes (`400`, `401`, `403`, `404`, `422`).
- Student verification failures return a deliberate generic `400 Bad Request` to prevent malicious probing of the official roster.
- Database operations enforce ACID consistency via async transactions.
