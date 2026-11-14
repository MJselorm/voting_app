# UniVote — Multi-Tenant University & Organization Voting Platform

UniVote is a multi-tenant electronic voting and election management platform designed for higher education institutions, academic departments, student associations, corporate organizations, and professional bodies.

The platform provides a centralized, high-performance infrastructure with strict organization-level data isolation, universal user accounts, and two distinct voting experiences: **Formal Elections** and **Quick Polls**.

---

## Documentation Navigation Index

For comprehensive architecture, development, and operational specifications, consult the dedicated documentation in the repository and the **`docs/`** directory:

### Architecture & Agent Manuals
- **[AGENTS.md](AGENTS.md)** — **Primary instruction manual for AI coding agents and human contributors**. Covers multi-tenant rules, scoped roles, and non-negotiable coding standards.
- **[ARCHITECTURE.md](ARCHITECTURE.md)** — End-to-end multi-tenant system architecture, platform topology, and deployment design.
- **[PROJECT_MAP.md](PROJECT_MAP.md)** — Complete repository map detailing every directory, file, and module responsibility across frontend and backend.
- **[DECISIONS.md](DECISIONS.md)** — Architectural Decision Records (ADRs) explaining verified technical choices and trade-offs.

### API & Database Specifications
- **[API_REFERENCE.md](API_REFERENCE.md)** — Complete REST API reference detailing all endpoints, request bodies, response schemas, and authorization requirements.
- **[DATABASE_SCHEMA.md](DATABASE_SCHEMA.md)** — Relational database schema specification with table definitions, column types, foreign keys, and indexes.

### Task Management & Changelog
- **[TASK_TRACKER.md](TASK_TRACKER.md)** — High-level development progress tracker distinguishing completed prototype features from target multi-tenant roadmap items.
- **[CHANGELOG.md](CHANGELOG.md)** — Version release notes and development history.

### Comprehensive Multi-Tenant Guides (`docs/`)
- **[docs/README.md](docs/README.md)** — Complete documentation directory index.
- **Architecture**:
  - [System Architecture](docs/architecture/SYSTEM_ARCHITECTURE.md)
  - [Multi-Tenancy & Data Isolation](docs/architecture/MULTI_TENANCY.md)
  - [Universal Accounts & Membership](docs/architecture/USER_AND_MEMBERSHIP_ARCHITECTURE.md)
  - [Scoped Role & Permission Model](docs/architecture/ROLE_AND_PERMISSION_MODEL.md)
  - [Dual Voting Engine Architecture](docs/architecture/VOTING_ARCHITECTURE.md)
  - [Ballot Security & Secrecy](docs/architecture/BALLOT_SECURITY.md)
  - [Database Architecture](docs/architecture/DATABASE_ARCHITECTURE.md)
- **Functional Modules**:
  - [Organization Management](docs/modules/ORGANIZATION_MANAGEMENT.md)
  - [Membership Management](docs/modules/MEMBERSHIP_MANAGEMENT.md)
  - [Voter Eligibility & Roster Ingestion](docs/modules/VOTER_ELIGIBILITY.md)
  - [Formal Elections Module](docs/modules/FORMAL_ELECTIONS.md)
  - [Quick Polls Module](docs/modules/QUICK_POLLS.md)
  - [Results & Approvals](docs/modules/RESULTS_AND_APPROVALS.md)
- **Technical & Planning**:
  - [Implementation Master Checklist (TODO)](docs/planning/IMPLEMENTATION_TODO.md)
  - [Current Implementation Status & Gap Analysis](docs/planning/CURRENT_IMPLEMENTATION_STATUS.md)
  - [Product Roadmap](docs/planning/PRODUCT_ROADMAP.md)
  - [Development Phases](docs/planning/DEVELOPMENT_PHASES.md)
  - [Future Expansion (Mobile & SIS)](docs/planning/FUTURE_EXPANSION.md)
  - [Architectural Decision Records](docs/decisions/ARCHITECTURAL_DECISIONS.md)

---

## Target Multi-Tenant Architecture Highlights

1. **Universal User Accounts & Multi-Tenancy**:
   - Users register globally using any valid email address or Google OAuth.
   - A single user account can join and hold memberships in multiple organizations concurrently.
   - Membership verification cross-checks submitted institutional identifiers (Student ID, Staff ID) against the organization's authoritative roster.
2. **Six Scoped Roles**:
   - **Platform Super Admin**: Platform-wide infrastructure, tenant creation & approval, cross-org auditing.
   - **Organization Admin**: Institutional settings, departments, roster uploads, membership verification, staff role assignments.
   - **Election Official**: Configuration of formal elections, candidate vetting, balloting oversight, and interim turnout monitoring.
   - **Election Super Admin**: Final certification and sign-off on formal election results.
   - **Member / Voter**: Verified organizational member eligible to vote in ballots matching their criteria.
   - **Poll Creator**: Authorized member or staff member allowed to configure lightweight informal Quick Polls.
3. **Two Distinct Voting Modules**:
   - **Formal Elections**: Multi-position governance ballots with candidate vetting, FPTP balloting, vote editing before close, and certified result sign-off.
   - **Quick Polls**: Lightweight informal voting activities (e.g. Best Dressed, Favorite Lecturer) leveraging existing verified memberships without requiring spreadsheet roster uploads.
4. **Ballot Secrecy & Security**:
   - Physical and logical separation between voter participation ledgers and anonymized cast ballots.
   - Comprehensive, immutable audit logging tracking all administrative configuration and approval actions.

---

## Current Prototype Implementation Status

The existing repository codebase implements a verified single-institution prototype with the following functional components:
- **Authentication**: Universal Firebase email/password and Google OAuth authentication with cryptographic public-key verification via FastAPI's Firebase Admin SDK.
- **Roster Ingestion**: Spreadsheet parsing for `.csv` and `.xlsx` files with dry-run conflict detection, duplicate identification, and import audit logging.
- **Student Verification**: Multi-factor identity matching verifying student ID, normalized legal name, and email against the official roster.
- **Election Configuration**: Multi-step election setup wizard supporting contested offices (`ElectionPosition`), staff delegation (`ElectionOfficialAssignment`), and approval pipelines (`ElectionApproval`).
- **Live Statistics**: Exact single-query SQL aggregation for dashboard statistics backed by partial indexes.

*Note: Multi-tenant schemas (`organizations`, `organization_memberships`), Quick Polls, candidate nomination vetting, and ballot casting are documented as target development items and are not yet implemented in code.*

---

## Technology Stack

- **Frontend**: React 19, TypeScript, Vite, React Router DOM v7 (Target Hosting: **Vercel**).
- **Backend**: Python 3.11+ / 3.13, FastAPI, SQLAlchemy 2.0 (AsyncIO), Pydantic v2 (Target Hosting: **Render**).
- **Database**: PostgreSQL on Neon Serverless / Supabase, managed via Alembic.
- **Authentication**: Firebase Authentication + Firebase Admin SDK.
- **Future Mobile Clients**: iOS and Android mobile applications consuming the same FastAPI REST APIs.

---

## Setup & Local Development

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
