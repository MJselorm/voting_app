# UniVote — University Voting System

UniVote is a full-stack university voting application with Firebase authentication, FastAPI authorization, PostgreSQL/Supabase student records, and role-based dashboards.

## Current functionality

- Firebase email/password and Google authentication
- Email verification, password reset, and PostgreSQL user-profile sync
- Student-record CSV/XLSX preview and import for authorized staff
- Student identity verification and eligibility checks against official records
- Role-aware UI and protected routes for `STUDENT`, `ELECTION_OFFICIAL`, and `SUPER_ADMIN`
- Super Admin dashboard totals loaded from the database: uploaded student records, registered users, registered voters, and eligible voters

Election creation, candidate management, ballot casting, and final results are still planned features.

## Architecture

```text
React + TypeScript (Vite)
        │ Firebase ID token
        ▼
FastAPI + Firebase Admin SDK
        ▼
PostgreSQL / Supabase
```

The browser uses the role only to choose the appropriate interface. FastAPI verifies every Firebase token and enforces authorization server-side.

## Roles and routes

| Role | Dashboard | Key navigation |
|---|---|---|
| `STUDENT` | `/dashboard` | Elections, My Votes, Notifications, Profile |
| `ELECTION_OFFICIAL` | `/official/dashboard` | Elections, Student Records, Candidates, Results, Profile |
| `SUPER_ADMIN` | `/admin/dashboard` | Elections, Student Records, Users, Officials, Approvals, Departments, Results, Audit Logs, Settings, Profile |

Students cannot access official/admin UI routes. More importantly, backend dependencies protect APIs: student-record administration requires an Election Official or Super Admin, while dashboard totals require a Super Admin.

## Prerequisites

- Python 3.11+
- Node.js 18+
- Firebase project with Email/Password authentication enabled
- Supabase/PostgreSQL database

## Setup

### Environment variables

Create `frontend/.env`:

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_API_BASE_URL=http://localhost:8000
```

Create `backend/.env`:

```env
DATABASE_URL=postgresql://postgres:password@host:5432/postgres
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-...@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
ALLOWED_ORIGINS=http://localhost:5173
DEFAULT_ELIGIBLE_DEPARTMENT=Computer Science and Engineering
APP_ENV=development
```

### Install and run

```bash
# Backend
cd backend
python -m venv venv
# Windows: venv\Scripts\activate
# macOS/Linux: source venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

```bash
# Frontend, in another terminal
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. API documentation is available at `http://localhost:8000/docs` in development.

## Important API endpoints

All routes below, except `/health`, require `Authorization: Bearer <firebase_id_token>`.

| Method | Path | Access | Purpose |
|---|---|---|---|
| `GET` | `/health` | Public | Health check |
| `POST` | `/api/auth/sync` | Authenticated | Create/sync the PostgreSQL user profile |
| `GET` | `/api/auth/me` | Authenticated | Current user profile and role |
| `POST` | `/api/auth/verify-student` | Authenticated | Verify against the official student record |
| `POST` | `/api/eligibility/check` | Authenticated | Check voting eligibility |
| `GET` | `/api/auth/admin/dashboard-stats` | Super Admin | Exact dashboard counts in one response |
| `POST` | `/api/admin/students/import/preview` | Official/Admin | Validate an upload before import |
| `POST` | `/api/admin/students/import/confirm` | Official/Admin | Commit an approved student import |
| `GET` | `/api/admin/students` | Official/Admin | Search official student records |

## Dashboard statistics

`GET /api/auth/admin/dashboard-stats` returns one exact-count response:

```json
{
  "uploaded_student_records": 1250,
  "registered_users": 82,
  "registered_voters": 74,
  "eligible_voters": 61,
  "verified_voters": 59
}
```

The frontend displays the current required metrics. The endpoint uses database `COUNT()` queries only and does not download tables to calculate totals. Focused indexes are included in Alembic migration `007_dashboard_stats_indexes`.

## Database records

- `users`: application accounts linked to a Firebase UID; includes role, active status, verification state, and optional student ID.
- `students`: official university records imported from CSV/XLSX; includes academic details and active/inactive status.
- `student_imports`: audit records for imports.

New registrations always receive the `STUDENT` role. The client cannot set roles; trusted administrative workflows must assign staff roles directly through the backend/database process.

## Validation

```bash
cd backend
python -m compileall -q app

cd ../frontend
npm run build
```

## Security notes

- Passwords are handled by Firebase and are never stored in PostgreSQL.
- FastAPI verifies Firebase tokens with Firebase Admin SDK.
- Frontend route guards improve UX; backend dependencies are the authority for access control.
- Keep `.env` files and Firebase service-account secrets out of Git.
