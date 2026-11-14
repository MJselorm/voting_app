# API_REFERENCE.md — UniVote REST API Specification

This document provides a complete technical reference for all existing and planned REST endpoints in the UniVote backend.

Every authenticated endpoint requires an HTTP header formatted as:
```http
Authorization: Bearer <FIREBASE_ID_TOKEN>
```

---

## 1. Implemented Endpoints

### 1.1 System & Health

#### `GET /health`
- **Purpose**: Verifies that the API server is operational and can query the PostgreSQL database.
- **Authentication**: None (Public).
- **Required Role**: None.
- **Source Files**: `backend/app/main.py`.
- **Response `200 OK`**:
  ```json
  {
    "status": "ok",
    "env": "development",
    "database": "connected",
    "realtime_configured": false
  }
  ```

---

### 1.2 Authentication & User Profiles (`/api/auth`)

#### `POST /api/auth/sync`
- **Purpose**: Creates or retrieves the user profile in PostgreSQL following Firebase authentication. Ensures every new account receives the `STUDENT` role.
- **Authentication**: Required (Valid Firebase ID token).
- **Required Role**: Any authenticated user.
- **Source Files**: `backend/app/api/auth.py`.
- **Request Body**:
  ```json
  {
    "full_name": "Kofi Mensah",
    "email": "kmensah@st.ug.edu.gh",
    "student_id": "10987654"
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "user": {
      "id": "c1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c",
      "firebase_uid": "FirebaseUidString123",
      "student_id": "10987654",
      "full_name": "Kofi Mensah",
      "email": "kmensah@st.ug.edu.gh",
      "role": "STUDENT",
      "is_active": true,
      "is_verified": false,
      "verified_at": null,
      "created_at": "2026-08-14T10:00:00Z",
      "updated_at": "2026-08-14T10:00:00Z"
    },
    "is_new": false
  }
  ```

#### `GET /api/auth/me`
- **Purpose**: Returns the authenticated user's profile and current verification status.
- **Authentication**: Required.
- **Required Role**: Any active user (`get_current_user`).
- **Source Files**: `backend/app/api/auth.py`.
- **Response `200 OK`**: Returns `UserResponse` object.

#### `PATCH /api/auth/me`
- **Purpose**: Allows a student to update their personal profile (full name, student ID). If the student ID is changed, identity verification is reset (`is_verified = False`, `verified_at = None`).
- **Authentication**: Required.
- **Required Role**: Any active user.
- **Source Files**: `backend/app/api/auth.py`.
- **Request Body**:
  ```json
  {
    "full_name": "Kofi Mensah Updated",
    "student_id": "10987654"
  }
  ```
- **Response `200 OK`**: Returns updated `UserResponse`.

#### `POST /api/auth/verify-student`
- **Purpose**: Verifies student identity by matching application user attributes (`student_id`, normalized `full_name`, and lowercase `email`) against an active record in the official `students` roster.
- **Authentication**: Required.
- **Required Role**: Any active user.
- **Source Files**: `backend/app/api/auth.py`, `backend/app/services/student_verification.py`.
- **Request Body**: None (Uses current authenticated user).
- **Response `200 OK`**:
  ```json
  {
    "verified": true,
    "message": "Student identity verified successfully."
  }
  ```
- **Errors**:
  - `400 BAD REQUEST`: Generic failure message `"Student verification failed. Details do not match official records."` (prevents roster probing).

#### `GET /api/auth/admin/dashboard-stats`
- **Purpose**: Delivers live database totals for the Super Admin overview in a single aggregation query.
- **Authentication**: Required.
- **Required Role**: `SUPER_ADMIN` (`require_admin`).
- **Source Files**: `backend/app/api/auth.py`, `backend/app/services/admin.py`.
- **Response `200 OK`**:
  ```json
  {
    "uploaded_student_records": 1250,
    "registered_users": 82,
    "registered_voters": 74,
    "eligible_voters": 61,
    "verified_voters": 59
  }
  ```

---

### 1.3 Student Identity & Roster Administration (`/api/admin/students` & `/api/students`)

#### `GET /api/students/me`
- **Purpose**: Returns the official academic record linked to the authenticated student's verified ID.
- **Authentication**: Required.
- **Required Role**: Any active user.
- **Source Files**: `backend/app/api/students.py`.
- **Response `200 OK`**: Returns `Student` model attributes (department, level, class, status).

#### `POST /api/admin/students/import/preview`
- **Purpose**: Parses an uploaded `.csv` or `.xlsx` roster file, checks for required headers, validates email syntax, and detects new vs. conflicting existing records.
- **Authentication**: Required.
- **Required Role**: `ELECTION_OFFICIAL` or `SUPER_ADMIN` (`require_election_official`).
- **Source Files**: `backend/app/api/students.py`, `backend/app/services/csv_importer.py`.
- **Request**: Multipart Form Data (`file: UploadFile`).
- **Response `200 OK`**:
  ```json
  {
    "preview_id": "temp_preview_hash",
    "total_rows": 250,
    "new_count": 240,
    "existing_count": 10,
    "invalid_count": 0,
    "records": [...],
    "errors": []
  }
  ```

#### `POST /api/admin/students/import/confirm`
- **Purpose**: Persists validated roster records into the `students` table and logs the import in `student_imports`.
- **Authentication**: Required.
- **Required Role**: `ELECTION_OFFICIAL` or `SUPER_ADMIN`.
- **Source Files**: `backend/app/api/students.py`, `backend/app/services/csv_importer.py`.
- **Request Body**:
  ```json
  {
    "preview_id": "temp_preview_hash",
    "existing_record_behavior": "update"
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "message": "Student records imported successfully",
    "added_count": 240,
    "updated_count": 10
  }
  ```

#### `GET /api/admin/students`
- **Purpose**: Searches and filters official student records.
- **Authentication**: Required.
- **Required Role**: `ELECTION_OFFICIAL` or `SUPER_ADMIN`.
- **Source Files**: `backend/app/api/students.py`.
- **Query Parameters**: `search` (string), `department` (string), `status` (string), `limit` (int, default 50).
- **Response `200 OK`**: Array of `Student` objects.

#### `PATCH /api/admin/students/{student_id}`
- **Purpose**: Manually updates an official student's academic attributes or active status.
- **Authentication**: Required.
- **Required Role**: `ELECTION_OFFICIAL` or `SUPER_ADMIN`.
- **Source Files**: `backend/app/api/students.py`.

#### `DELETE /api/admin/students/{student_id}`
- **Purpose**: Deletes an official student record from the database.
- **Authentication**: Required.
- **Required Role**: `ELECTION_OFFICIAL` or `SUPER_ADMIN`.
- **Source Files**: `backend/app/api/students.py`.

---

### 1.4 Voting Eligibility (`/api/eligibility`)

#### `POST /api/eligibility/check`
- **Purpose**: Evaluates whether the authenticated user meets the criteria to vote in an election.
- **Authentication**: Required.
- **Required Role**: Any active user.
- **Source Files**: `backend/app/api/eligibility.py`, `backend/app/services/eligibility.py`.
- **Request Body** (Optional criteria overrides):
  ```json
  {
    "election_id": "optional-uuid",
    "target_criteria": {
      "department": "Computer Science and Engineering"
    }
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "is_eligible": true,
    "reason": "Student meets all eligibility requirements for this election."
  }
  ```

---

### 1.5 Elections & Configuration (`/api/elections`)

#### `GET /api/elections`
- **Purpose**: Lists elections visible to the user. Officials and Admins see assigned/managed elections; students see public, scheduled, and live ballots.
- **Authentication**: Required.
- **Required Role**: Any authenticated user.
- **Source Files**: `backend/app/api/elections.py`.
- **Response `200 OK`**: Array of `ElectionListItemResponse`.

#### `POST /api/elections`
- **Purpose**: Creates a new election draft including contested positions and assigned officials.
- **Authentication**: Required.
- **Required Role**: `ELECTION_OFFICIAL` or `SUPER_ADMIN`.
- **Source Files**: `backend/app/api/elections.py`, `backend/app/services/elections.py`.
- **Request Body**:
  ```json
  {
    "name": "CSE Departmental Elections 2026",
    "description": "Annual executive committee elections",
    "department": "Computer Science and Engineering",
    "election_type": "Departmental Election",
    "start_at": "2026-10-01T08:00:00Z",
    "end_at": "2026-10-01T17:00:00Z",
    "result_visibility": "OFFICIALS_DURING_VOTING",
    "eligibility_criteria": {
      "departments": ["Computer Science and Engineering"],
      "levels": ["200", "300", "400"],
      "statuses": ["ACTIVE"]
    },
    "positions": [
      { "name": "President", "description": "Head of Association", "display_order": 1, "number_of_winners": 1 },
      { "name": "Secretary", "description": "General Secretary", "display_order": 2, "number_of_winners": 1 }
    ],
    "assigned_official_ids": ["uuid-1", "uuid-2"]
  }
  ```
- **Response `201 CREATED`**: Returns `ElectionDetailResponse`.

#### `GET /api/elections/{id}`
- **Purpose**: Retrieves comprehensive election details including positions, assignments, approvals, and audit trail.
- **Authentication**: Required.
- **Required Role**: Authenticated (Subject to status and role access rules).
- **Source Files**: `backend/app/api/elections.py`.

#### `PUT /api/elections/{id}`
- **Purpose**: Updates an election configuration. Only allowed while status is `DRAFT`.
- **Authentication**: Required.
- **Required Role**: Creator, Assigned Official, or Super Admin.
- **Source Files**: `backend/app/api/elections.py`.

#### `POST /api/elections/{id}/submit`
- **Purpose**: Transitions election status from `DRAFT` to `PENDING_APPROVAL` or `OFFICIAL_REVIEW`.
- **Authentication**: Required.
- **Required Role**: Election Creator or Super Admin.
- **Source Files**: `backend/app/api/elections.py`.

#### `POST /api/elections/{id}/approve`
- **Purpose**: Records an official's review and approval.
- **Authentication**: Required.
- **Required Role**: Assigned `ELECTION_OFFICIAL` or `SUPER_ADMIN`.
- **Source Files**: `backend/app/api/elections.py`.

#### `POST /api/elections/{id}/reject`
- **Purpose**: Records rejection of an election configuration with feedback.
- **Authentication**: Required.
- **Required Role**: Assigned `ELECTION_OFFICIAL` or `SUPER_ADMIN`.
- **Source Files**: `backend/app/api/elections.py`.

#### `POST /api/elections/{id}/final-approve`
- **Purpose**: Final authorization promoting election status to `APPROVED` or `SCHEDULED`.
- **Authentication**: Required.
- **Required Role**: `SUPER_ADMIN`.
- **Source Files**: `backend/app/api/elections.py`.

#### `GET /api/elections/officials/list`
- **Purpose**: Lists users eligible for election official assignment.
- **Authentication**: Required.
- **Required Role**: `ELECTION_OFFICIAL` or `SUPER_ADMIN`.
- **Source Files**: `backend/app/api/elections.py`.

#### `POST /api/elections/estimate-eligibility`
- **Purpose**: Calculates the estimated voter turnout count for a set of draft eligibility criteria.
- **Authentication**: Required.
- **Required Role**: `ELECTION_OFFICIAL` or `SUPER_ADMIN`.
- **Source Files**: `backend/app/api/elections.py`.

---

### 1.6 Super Admin Governance (`/api/admin`)

#### `GET /api/admin/users`
- **Purpose**: Paginated listing of application accounts with filtering by role, active status, verification status, or search query.
- **Authentication**: Required.
- **Required Role**: `SUPER_ADMIN`.
- **Source Files**: `backend/app/api/admin.py`.

#### `GET /api/admin/users/stats`
- **Purpose**: Summary metrics of user distribution across roles.
- **Authentication**: Required.
- **Required Role**: `SUPER_ADMIN`.
- **Source Files**: `backend/app/api/admin.py`.

#### `PATCH /api/admin/users/{user_id}/role`
- **Purpose**: Promotes or demotes a user's role (`STUDENT`, `ELECTION_OFFICIAL`, `SUPER_ADMIN`).
- **Authentication**: Required.
- **Required Role**: `SUPER_ADMIN`.
- **Source Files**: `backend/app/api/admin.py`.

#### `PATCH /api/admin/users/{user_id}/status`
- **Purpose**: Activates or deactivates a user account.
- **Authentication**: Required.
- **Required Role**: `SUPER_ADMIN`.
- **Source Files**: `backend/app/api/admin.py`.

#### `GET /api/admin/officials`
- **Purpose**: Returns all users with `ELECTION_OFFICIAL` or `SUPER_ADMIN` roles and their historical assignment counts.
- **Authentication**: Required.
- **Required Role**: `SUPER_ADMIN`.
- **Source Files**: `backend/app/api/admin.py`.

#### `POST /api/admin/officials/assign`
- **Purpose**: Assigns staff role to an existing user.
- **Authentication**: Required.
- **Required Role**: `SUPER_ADMIN`.
- **Source Files**: `backend/app/api/admin.py`.

#### `GET /api/admin/approvals`
- **Purpose**: Retrieves all elections currently requiring review or final sign-off in the approval queue.
- **Authentication**: Required.
- **Required Role**: `SUPER_ADMIN`.
- **Source Files**: `backend/app/api/admin.py`.

#### `POST /api/admin/approvals/{election_id}/final-approve`
- **Purpose**: Super Admin fast-track / final sign-off for pending elections.
- **Authentication**: Required.
- **Required Role**: `SUPER_ADMIN`.
- **Source Files**: `backend/app/api/admin.py`.

#### `POST /api/admin/approvals/{election_id}/reject`
- **Purpose**: Super Admin rejection of a submitted election.
- **Authentication**: Required.
- **Required Role**: `SUPER_ADMIN`.
- **Source Files**: `backend/app/api/admin.py`.

---

## 2. Planned Endpoints (Not Yet Implemented)

The following endpoints represent future phases (balloting, voting, and candidate management):

| Method | Route | Planned Purpose |
|---|---|---|
| `POST` | `/api/elections/{id}/candidates` | Register/nominate candidate for a position |
| `GET` | `/api/elections/{id}/candidates` | List vetted candidates for an election |
| `PATCH` | `/api/candidates/{id}/vet` | Approve or reject a candidate nomination |
| `GET` | `/api/elections/{id}/ballot` | Retrieve active ballot containing positions and candidates |
| `POST` | `/api/elections/{id}/vote` | Cast encrypted ballot selections |
| `PUT` | `/api/elections/{id}/vote` | Edit submitted selections prior to election close |
| `GET` | `/api/elections/{id}/results` | Tally and return election outcome according to visibility rules |
| `POST` | `/api/elections/{id}/publish` | Certify and publicly release final results |
| `GET` | `/api/notifications` | User alerts and institutional announcements |
