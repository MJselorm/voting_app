# API_DESIGN.md — REST API Conventions & Endpoint Specifications

This document specifies the REST API design conventions, URL hierarchies, HTTP status codes, and endpoint specifications for **UniVote**.

---

## 1. REST API Conventions

- **Base Route Prefix**: All application endpoints are mounted under `/api/`.
- **Multi-Tenant Scoping**: Organization-scoped operations use `/api/orgs/{org_id}/...` or provide the `X-Organization-ID: <UUID>` header.
- **Resource Naming**: Plural nouns for collections (e.g. `/api/elections`, `/api/orgs`, `/api/polls`).
- **HTTP Methods**:
  - `GET`: Safe, idempotent read operations.
  - `POST`: Creation of resources, complex queries, or state machine transitions.
  - `PUT`: Full replacement of a resource.
  - `PATCH`: Partial updates to resource attributes.
  - `DELETE`: Removal of resources.
- **Status Codes**:
  - `200 OK`: Successful read or update.
  - `201 CREATED`: Successful resource creation.
  - `204 NO CONTENT`: Successful deletion with empty response.
  - `400 BAD REQUEST`: Semantic or validation error (e.g., failed identity check).
  - `401 UNAUTHORIZED`: Missing, invalid, or expired Firebase ID token.
  - `403 FORBIDDEN`: Deactivated account or insufficient scoped privileges.
  - `404 NOT FOUND`: Target entity does not exist.
  - `422 UNPROCESSABLE ENTITY`: Pydantic validation failure.

---

## 2. API Endpoints Specification

### 2.1 System & Authentication

#### `GET /health`
- **Access**: Public.
- **Purpose**: Verifies that the API server is online.
- **Current Response**: `{ "status": "ok" }`.

#### `GET /api/health`
- **Access**: Public.
- **Purpose**: Application health route under the API base prefix.
- **Current Response**: `{ "status": "ok" }`.

#### `POST /api/auth/sync`
- **Access**: Authenticated (Bearer Token).
- **Purpose**: Creates or retrieves the global user profile in PostgreSQL following Firebase sign-in.
- **Verified-Email Requirement**: `email_verified=true` is required.
- **Request Body**: No identity fields are accepted. UID and email are derived from the verified Firebase token.

#### `GET /api/auth/me`
- **Access**: Authenticated.
- **Purpose**: Returns the current user's universal account profile.
- **Verified-Email Requirement**: `email_verified=true` is required.

#### `PATCH /api/auth/me`
- **Access**: Authenticated.
- **Purpose**: Updates the caller's full name.
- **Verified-Email Requirement**: `email_verified=true` is required.
- **Request Body**: `{ "full_name": "string" }`
- **Restricted Fields**: IDs, email, verification state, active state, timestamps, and administrative fields are not client-modifiable.

---

### 2.2 Organizations & Memberships (`/api/orgs`)

#### `GET /api/orgs`
- **Access**: Authenticated.
- **Purpose**: Lists organizations available for joining.

#### `POST /api/orgs`
- **Access**: Platform Super Admin (`require_platform_admin`).
- **Purpose**: Creates and activates a new organizational tenant.

#### `POST /api/orgs/{org_id}/join`
- **Access**: Authenticated.
- **Purpose**: Submits a request to join an organization with institutional identifier (Student ID, Staff ID).

#### `POST /api/orgs/{org_id}/verify`
- **Access**: Authenticated Member.
- **Purpose**: Initiates automated verification comparing user credentials against the organization's roster.

---

### 2.3 Roster Management & Voter Eligibility

#### `POST /api/orgs/{org_id}/registers/preview`
- **Access**: Organization Admin or Election Official (`require_org_admin`).
- **Purpose**: Parses an uploaded `.csv` or `.xlsx` spreadsheet and returns dry-run validation results.

#### `POST /api/orgs/{org_id}/registers/confirm`
- **Access**: Organization Admin or Election Official.
- **Purpose**: Commits validated voter roster records to `organization_voter_registers`.

#### `POST /api/orgs/{org_id}/elections/{id}/eligibility-check`
- **Access**: Authenticated Member.
- **Purpose**: Evaluates whether the user is eligible to vote in a specific election.

---

### 2.4 Formal Elections (`/api/orgs/{org_id}/elections`)

#### `GET /api/orgs/{org_id}/elections`
- **Access**: Authenticated.
- **Purpose**: Lists visible elections (filtered by user standing and election visibility settings).

#### `POST /api/orgs/{org_id}/elections`
- **Access**: Organization Admin or Election Official.
- **Purpose**: Creates a new formal election draft with contested positions and eligibility criteria.

#### `GET /api/orgs/{org_id}/elections/{id}`
- **Access**: Authenticated.
- **Purpose**: Retrieves complete election details, positions, candidate lists, and schedule.

#### `PUT /api/orgs/{org_id}/elections/{id}`
- **Access**: Assigned Election Official or Organization Admin.
- **Purpose**: Updates election draft configuration.

#### `POST /api/orgs/{org_id}/elections/{id}/submit`
- **Access**: Assigned Election Official.
- **Purpose**: Submits draft election for review (`DRAFT` → `OFFICIAL_REVIEW`).

#### `POST /api/orgs/{org_id}/elections/{id}/final-approve`
- **Access**: Election Super Admin (`require_election_super_admin`).
- **Purpose**: Certifies preliminary tallies and publishes final election results.

#### `POST /api/orgs/{org_id}/elections/{id}/vote`
- **Access**: Eligible Member.
- **Purpose**: Casts or edits an encrypted, anonymous ballot during the `LIVE` window.

---

### 2.5 Quick Polls (`/api/orgs/{org_id}/polls`)

#### `GET /api/orgs/{org_id}/polls`
- **Access**: Authenticated (or Public for public polls).
- **Purpose**: Lists active and completed quick polls.

#### `POST /api/orgs/{org_id}/polls`
- **Access**: Authorized Poll Creator or Organization Admin.
- **Purpose**: Configures and publishes a lightweight quick poll with options and audience targeting.

#### `POST /api/orgs/{org_id}/polls/{id}/vote`
- **Access**: Eligible Audience (Public, Member, or Restricted Group).
- **Purpose**: Casts a vote in an informal quick poll with duplicate-prevention enforcement.
