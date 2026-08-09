# UniVote — University Voting System

A secure, full-stack university voting application.

**Current Phase: Authentication Foundation**

> Authentication is complete. Elections, voting, and results will be built in subsequent phases.

---

## Architecture

```
React + TypeScript (Vite)          →  Vercel
         │
         ▼
Firebase Authentication
         │  Firebase ID Token (Bearer header)
         ▼
FastAPI (Python)                   →  Render
         │
         ▼
PostgreSQL / Supabase
```

---

## Project Structure

```
project/
├── frontend/                   React + TypeScript + Vite
│   ├── src/
│   │   ├── auth/               AuthContext, ProtectedRoute
│   │   ├── hooks/              useAuth
│   │   ├── lib/                firebase.ts  (single init point)
│   │   ├── pages/              Login, Register, Dashboard, etc.
│   │   ├── services/           api.ts  (fetch wrapper with Bearer token)
│   │   ├── App.tsx             Router + AuthProvider
│   │   └── index.css           Global design system
│   └── .env.example
│
├── backend/                    Python + FastAPI
│   ├── app/
│   │   ├── api/                auth.py  (POST /sync, GET /me)
│   │   ├── auth/               dependencies.py  (get_current_user)
│   │   ├── core/               config.py, firebase_admin.py
│   │   ├── database/           base.py, session.py
│   │   ├── models/             user.py, student.py
│   │   ├── schemas/            user.py (Pydantic)
│   │   └── main.py             FastAPI app entry point
│   ├── migrations/             Alembic migrations
│   ├── requirements.txt
│   └── .env.example
│
├── .gitignore
└── README.md
```

---

## Prerequisites

- Python 3.11+
- Node.js 18+
- A [Firebase project](https://console.firebase.google.com/) with **Email/Password** authentication enabled
- A [Supabase](https://supabase.com/) project (PostgreSQL database)

---

## 1. Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project (or use an existing one)
3. Enable **Authentication → Sign-in method → Email/Password**
4. **Frontend credentials** (Project Settings → Your Apps → Web App):
   - Copy the `firebaseConfig` values into `frontend/.env`
5. **Backend credentials** (Project Settings → Service Accounts → Generate new private key):
   - Download the JSON file
   - Copy the values into `backend/.env` (see format below)

---

## 2. Environment Setup

### Frontend (`frontend/.env`)

```env
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
VITE_API_BASE_URL=http://localhost:8000
```

### Backend (`backend/.env`)

```env
DATABASE_URL=postgresql+asyncpg://postgres:password@db.xxxx.supabase.co:5432/postgres
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_KEY\n-----END PRIVATE KEY-----\n"
ALLOWED_ORIGINS=http://localhost:5173
APP_ENV=development
```

> **FIREBASE_PRIVATE_KEY format**: Copy the `private_key` value from the downloaded JSON.
> Replace actual newlines with `\n` and wrap the entire value in double quotes.

---

## 3. Install Dependencies

### Backend

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate

# macOS / Linux
source venv/bin/activate

pip install -r requirements.txt
```

### Frontend

```bash
cd frontend
npm install
```

---

## 4. Database Migrations

Run once after setting up your `.env`:

```bash
cd backend

# With venv activated:
alembic upgrade head
```

This creates the `users` and `students` tables in your Supabase PostgreSQL database.

To generate a new migration after model changes:

```bash
alembic revision --autogenerate -m "describe your change"
alembic upgrade head
```

---

## 5. Run Locally

### Backend (terminal 1)

```bash
cd backend
# Windows: venv\Scripts\activate | macOS/Linux: source venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

API available at: http://localhost:8000  
Interactive docs: http://localhost:8000/docs

### Frontend (terminal 2)

```bash
cd frontend
npm run dev
```

App available at: http://localhost:5173

---

## 6. API Endpoints

| Method | Path | Auth Required | Description |
|---|---|---|---|
| `GET` | `/health` | No | Health check |
| `POST` | `/api/auth/sync` | No | Sync Firebase user to PostgreSQL |
| `GET` | `/api/auth/me` | Yes | Get current user profile |

### Authentication

All protected endpoints require:

```http
Authorization: Bearer <firebase_id_token>
```

### Example: GET /api/auth/me

**Response:**
```json
{
  "id": "uuid",
  "firebase_uid": "abc123",
  "student_id": "STU/2024/0001",
  "full_name": "Kwame Mensah",
  "email": "kwame@university.edu.gh",
  "role": "STUDENT",
  "is_active": true,
  "created_at": "2026-01-01T00:00:00Z",
  "updated_at": "2026-01-01T00:00:00Z"
}
```

---

## 7. Authentication Flow

```
Student opens /register
     ↓
Fills: Full Name, Student ID, Email, Password
     ↓
Frontend validates fields
     ↓
Firebase creates account (email/password)
     ↓
Firebase sends verification email
     ↓
Frontend calls POST /api/auth/sync → creates PostgreSQL user (role=STUDENT)
     ↓
Student redirected to /verify-email
     ↓
Student verifies email in inbox
     ↓
Student clicks "I've Verified My Email"
     ↓
Frontend calls firebase.reload() → emailVerified = true
     ↓
Student navigates to /dashboard
     ↓
Dashboard calls GET /api/auth/me
     ↓
FastAPI: reads Authorization header → verifies Firebase ID token → returns user
```

---

## 8. How Firebase Tokens Reach FastAPI

1. Firebase signs in the user and issues an ID token (JWT)
2. `getIdToken(forceRefresh=true)` is called before each API request
3. Token is sent in the `Authorization: Bearer <token>` header
4. FastAPI reads the header via `HTTPBearer`
5. Firebase Admin SDK verifies the token cryptographically
6. Firebase UID is extracted from the verified token
7. PostgreSQL is queried for the matching user record
8. User is returned to the route handler

---

## 9. Database Schema

```sql
-- User accounts (linked to Firebase Auth)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firebase_uid VARCHAR(128) UNIQUE NOT NULL,
    student_id VARCHAR(50) UNIQUE,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(320) UNIQUE NOT NULL,
    role VARCHAR NOT NULL DEFAULT 'STUDENT',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Official student records (populated via CSV in Phase 2)
CREATE TABLE students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id VARCHAR(50) UNIQUE NOT NULL,
    full_name VARCHAR(255),
    email VARCHAR(320) UNIQUE,
    department VARCHAR(255),
    level VARCHAR(50),
    class VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 10. Security Notes

| Rule | Implementation |
|---|---|
| No passwords stored | Only `firebase_uid` in PostgreSQL |
| Token verified server-side | Firebase Admin SDK (never manual JWT decode) |
| Roles never from client | Backend always sets `role = STUDENT` |
| Admin keys backend-only | `FIREBASE_PRIVATE_KEY` only in `backend/.env` |
| No secrets in Git | `.gitignore` covers all `.env` files |
| Input validated | Pydantic schemas on all endpoints |
| CORS locked | Only listed origins allowed |

---

## 11. Roles

| Role | Description | How Assigned |
|---|---|---|
| `STUDENT` | Default for all new registrations | Automatically on registration |
| `ELECTION_OFFICIAL` | Manages elections | Admin operation (Phase 2) |
| `SUPER_ADMIN` | Full system access | Admin operation |

> ⚠️ Users can never self-assign roles. The `role` field in any registration payload is ignored.

---

## 12. Testing the Auth Flow

1. **Register**: Go to `/register` → fill form → check email inbox
2. **Verify**: Click link in email → return to app → click "I've Verified"
3. **Login**: Go to `/login` → enter credentials → confirm redirect to `/dashboard`
4. **Profile**: Dashboard calls `GET /api/auth/me` → shows profile cards
5. **Password Reset**: Go to `/forgot-password` → enter email → check inbox
6. **Logout**: Click "Sign Out" → confirm redirect to `/login`
7. **Protected Route**: With no token, visit `/dashboard` → confirm redirect to `/login`
8. **Invalid Token**: Send an invalid token to `GET /api/auth/me` → expect `401`

---

## 13. Deployment

### Frontend → Vercel

```bash
# Set all VITE_ env vars in Vercel project settings
# Set VITE_API_BASE_URL=https://your-api.onrender.com
npm run build
# Deploy via Vercel CLI or GitHub integration
```

### Backend → Render

```bash
# Set all backend env vars in Render environment settings
# Start command:
uvicorn app.main:app --host 0.0.0.0 --port $PORT
# Add ALLOWED_ORIGINS=https://your-app.vercel.app
```

Run migrations on first deploy:
```bash
alembic upgrade head
```

---

## 14. Coming Next (Phase 2+)

- CSV/Excel student record import
- Student ID verification against official records
- Election management (create, open, close elections)
- Candidate nominations
- Ballot casting with eligibility checks
- Real-time results
- Election officials dashboard
- Super Admin dashboard
