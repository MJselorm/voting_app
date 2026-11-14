# UniVote — Multi-Tenant University & Organization Voting Platform

UniVote is a multi-tenant electronic voting and election management platform designed for higher education institutions, academic departments, student associations, corporate organizations, and professional bodies.

The platform provides a centralized, high-performance infrastructure with strict organization-level data isolation, universal user accounts, and two distinct voting experiences: **Formal Elections** and **Quick Polls**.

---

## Documentation Navigation (12 Core Documents)

All technical, architectural, and planning documentation is organized into 12 core documents:

| Document | Primary Responsibility |
|---|---|
| **[README.md](README.md)** | System overview, technology stack, local setup, and core documentation navigation |
| **[docs/SYSTEM_ARCHITECTURE.md](docs/SYSTEM_ARCHITECTURE.md)** | Overall system architecture, multi-tenant topology, and component interactions |
| **[docs/DATABASE_ARCHITECTURE.md](docs/DATABASE_ARCHITECTURE.md)** | Database entities, relational models, multi-tenant partitioning, and migrations |
| **[docs/AUTH_AND_MEMBERSHIP.md](docs/AUTH_AND_MEMBERSHIP.md)** | Universal account registration, Firebase authentication, and organization membership lifecycle |
| **[docs/ROLES_AND_PERMISSIONS.md](docs/ROLES_AND_PERMISSIONS.md)** | Six-tier scoped role model, authorities, and access boundaries |
| **[docs/ORGANIZATION_MANAGEMENT.md](docs/ORGANIZATION_MANAGEMENT.md)** | Organization onboarding, tenant settings, departments, and staff role assignment |
| **[docs/FORMAL_ELECTIONS.md](docs/FORMAL_ELECTIONS.md)** | Formal election lifecycle, multi-position balloting, candidate vetting, and FPTP voting |
| **[docs/QUICK_POLLS.md](docs/QUICK_POLLS.md)** | Informal quick polls, zero-roster member voting, and audience targeting |
| **[docs/VOTING_SECURITY.md](docs/VOTING_SECURITY.md)** | Ballot secrecy, voter participation decoupling, anti-duplication, and audit trails |
| **[docs/API_DESIGN.md](docs/API_DESIGN.md)** | REST API conventions, multi-tenant routes, status codes, and endpoint specifications |
| **[docs/IMPLEMENTATION_TODO.md](docs/IMPLEMENTATION_TODO.md)** | Phased implementation master checklist across 8 development phases |
| **[docs/CURRENT_IMPLEMENTATION_STATUS.md](docs/CURRENT_IMPLEMENTATION_STATUS.md)** | Verified repository implementation status and architectural gap analysis |

---

## Architectural Highlights

1. **Multi-Organization Platform**: Centralized backend and database infrastructure supporting independent organizations (universities, colleges, student unions, companies) with strict data isolation (`organization_id`).
2. **Universal Accounts & Membership**: Users register once with any valid email address via Firebase Auth. An account can join multiple organizations. Membership verification cross-checks submitted institutional identifiers (Student ID, Staff ID) against the organization's authoritative roster.
3. **Six Scoped Roles**:
   - `Platform Super Admin`: Global infrastructure and organization onboarding.
   - `Organization Admin`: Organization settings, roster uploads, and staff role delegation.
   - `Election Official`: Formal election setup, candidate vetting, and balloting oversight.
   - `Election Super Admin`: Final certification and sign-off on election results.
   - `Member/Voter`: Verified member participating in eligible ballots.
   - `Poll Creator`: Authorized member or staff configuring lightweight Quick Polls.
4. **Dual Voting Modules**:
   - **Formal Elections**: Multi-position governance ballots with candidate vetting, FPTP voting, vote editing before close, and certified result approval.
   - **Quick Polls**: Informal voting (e.g., Best Dressed, Favorite Lecturer) leveraging verified organization memberships without requiring spreadsheet roster uploads.
5. **Ballot Secrecy & Security**: Physical and logical decoupling between voter participation records and anonymized cast ballots. Comprehensive immutable audit trails (`election_audit_logs`).

---

## Technology Stack

- **Frontend**: React 19, TypeScript, Vite, React Router DOM v7 (Target Hosting: **Vercel**).
- **Backend**: Python 3.11+ / 3.13, FastAPI, SQLAlchemy 2.0 (AsyncIO), Pydantic v2 (Target Hosting: **Render**).
- **Database**: PostgreSQL on Neon Serverless / Supabase, managed via Alembic.
- **Authentication**: Universal Firebase Authentication (Email/Password, Google OAuth) + Firebase Admin SDK.
- **Future Mobile Clients**: iOS and Android native/cross-platform applications consuming the same FastAPI REST APIs.

---

## Current Prototype Implementation Status

The existing codebase implements a functional single-institution prototype:
- **Authentication**: Firebase email/password and Google OAuth authentication verified by FastAPI Firebase Admin SDK.
- **Roster Ingestion**: Spreadsheet parsing for `.csv` and `.xlsx` files with dry-run preview and duplicate detection.
- **Student Verification**: Multi-factor identity matching comparing student ID, normalized legal name, and email against the official roster.
- **Election Configuration Wizard**: Multi-step election setup wizard (`ElectionWizardPage.tsx`) supporting contested positions (`ElectionPosition`), official assignments (`ElectionOfficialAssignment`), and approval pipelines (`ElectionApproval`).
- **Live Statistics**: Single-query SQL aggregation for dashboard statistics backed by partial indexes.

*See [docs/CURRENT_IMPLEMENTATION_STATUS.md](docs/CURRENT_IMPLEMENTATION_STATUS.md) for the verified feature matrix and gap analysis.*

---

## Local Development Setup

### 1. Environment Configuration

Create `frontend/.env`:
```env
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
VITE_API_BASE_URL=http://localhost:8000
```

Create `backend/.env`:
```env
DATABASE_URL=postgresql://user:password@host:5432/neondb?sslmode=require
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
ALLOWED_ORIGINS=http://localhost:5173
DEFAULT_ELIGIBLE_DEPARTMENT=Computer Science and Engineering
APP_ENV=development
```

### 2. Install and Run

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
# Frontend (in another terminal)
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. Swagger API documentation is available at `http://localhost:8000/docs` in development mode.

---

## Quality & Validation Commands

```bash
# Verify backend Python code compilation
cd backend
python -m compileall -q app

# Run automated tests
pytest tests/ -v

# Verify frontend TypeScript compilation and build
cd ../frontend
npm run build
```
