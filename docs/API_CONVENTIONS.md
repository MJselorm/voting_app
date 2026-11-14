# API_CONVENTIONS.md — REST API Design & Development Standards

## 1. Overview

This document specifies the architectural conventions, schema design patterns, URL structures, and HTTP status codes enforced across all UniVote REST endpoints.

## 2. URL Design & Route Prefixing

- All application APIs must be prefixed with `/api/`.
- Plural nouns are used for resource collections (e.g. `/api/elections`, `/api/admin/users`, `/api/admin/students`).
- Sub-resources and actions:
  - Specific item: `/api/elections/{id}`
  - Nested collection: `/api/elections/{id}/positions`
  - Action trigger: `/api/elections/{id}/submit`, `/api/auth/verify-student`
- Health check is hosted at root: `GET /health`.

## 3. HTTP Methods & Semantics

- **`GET`**: Retrieve resources or query aggregates. Must be idempotent and side-effect free.
- **`POST`**: Create resources, initiate transitions, or run non-idempotent operations (e.g., file previews, approvals).
- **`PUT`**: Replace an existing resource in its entirety (e.g., updating full election configuration).
- **`PATCH`**: Partial update of designated fields (e.g. updating user role or profile attributes).
- **`DELETE`**: Remove resources.

## 4. HTTP Status Codes

- `200 OK`: Successful read or update with response payload.
- `201 CREATED`: Resource successfully created (accompanied by created entity).
- `204 NO CONTENT`: Deletion successful with no payload.
- `400 BAD REQUEST`: Invalid input payload or semantic failure (e.g., failed identity check).
- `401 UNAUTHORIZED`: Missing, expired, or invalid Firebase ID token.
- `403 FORBIDDEN`: Deactivated account or insufficient role privileges.
- `404 NOT FOUND`: Target entity does not exist.
- `422 UNPROCESSABLE ENTITY`: Pydantic validation failure on request structure or types.
- `500 INTERNAL SERVER ERROR`: Unhandled exception (logged server-side).

## 5. Pydantic Schemas

- Request bodies and response models must be defined in `backend/app/schemas/`.
- Response schemas must use `from_attributes = True` (Pydantic v2) to serialize directly from SQLAlchemy ORM entities.
- Field types must use explicit typing (`UUID`, `datetime`, `EmailStr`, `Enum`).
