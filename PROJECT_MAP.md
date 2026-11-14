# PROJECT_MAP.md — UniVote Codebase Directory Map

This document explains the organization, responsibilities, component structures, and file interactions across the UniVote repository.

---

## 1. Top-Level Repository Structure

```
Voting/
├── backend/                   # FastAPI Python application, migrations, and test suite
├── frontend/                  # React 19 + TypeScript + Vite single-page application
├── docs/                      # In-depth architectural, operational, and development guides
├── .env.local                 # Neon database deployment and branch connection settings
├── .gitignore                 # Git ignore rules for node_modules, python venv, and environment files
├── AGENTS.md                  # Comprehensive AI agent instruction manual and architecture rules
├── ARCHITECTURE.md            # Detailed end-to-end system architecture and data flows
├── PROJECT_MAP.md             # Codebase map and module responsibilities (this file)
├── API_REFERENCE.md           # Backend REST API specification
├── DATABASE_SCHEMA.md         # Database relational model, migrations, and constraints
├── TASK_TRACKER.md            # Feature tracker, completed capabilities, and roadmap
├── DECISIONS.md               # Architectural Decision Records (ADRs)
├── CHANGELOG.md               # Version history and release notes
├── CURRENT_STATUS.md          # Implementation milestones summary
├── README.md                  # Project overview, quickstart, and navigation index
├── STUD.csv                   # Sample student roster data for testing CSV import workflows
├── package.json               # Repository-level tooling (Neon scripts)
└── neon.ts                    # Neon database connection script
```

---

## 2. Backend Architecture (`backend/`)

The backend is built with FastAPI and structured according to clean separation of concerns:

```
backend/
├── app/
│   ├── __init__.py            # Application package initializer
│   ├── main.py                # FastAPI app initialization, lifespan hooks, CORS, router mounts, /health
│   ├── api/                   # REST API Routers
│   │   ├── __init__.py
│   │   ├── auth.py            # /api/auth endpoints: profile sync, me, verify-student, admin stats
│   │   ├── admin.py           # /api/admin endpoints: user administration, official assignment, approvals
│   │   ├── elections.py       # /api/elections endpoints: election wizard, lifecycle, approvals pipeline
│   │   ├── eligibility.py     # /api/eligibility endpoints: student voting eligibility checking
│   │   └── students.py        # /api/admin/students endpoints: CSV/XLSX import preview, confirm, list
│   ├── auth/                  # Authentication & Authorization dependencies
│   │   ├── __init__.py
│   │   └── dependencies.py    # HTTPBearer token extraction, Firebase validation, User lookup, role gates
│   ├── core/                  # Core runtime infrastructure
│   │   ├── __init__.py
│   │   ├── config.py          # Pydantic BaseSettings, environment variable loading, async connection parsing
│   │   └── firebase_admin.py  # Firebase Admin SDK initialization and public-key token verification
│   ├── database/              # Database layer
│   │   ├── __init__.py
│   │   ├── base.py            # SQLAlchemy DeclarativeBase
│   │   └── session.py         # Async engine configuration, sessionmaker, and get_db() dependency
│   ├── models/                # SQLAlchemy ORM database models
│   │   ├── __init__.py        # Re-exports models for clean imports and Alembic registration
│   │   ├── user.py            # User model, UserRole enum ('STUDENT', 'ELECTION_OFFICIAL', 'SUPER_ADMIN')
│   │   ├── student.py         # Official Student roster model
│   │   ├── student_import.py  # Audit logging model for student roster imports
│   │   └── election.py        # Election, ElectionPosition, ElectionOfficialAssignment, ElectionApproval, ElectionAuditLog
│   ├── schemas/               # Pydantic schemas (Request / Response DTOs)
│   │   ├── __init__.py
│   │   ├── user.py            # UserSyncRequest, UserResponse, UserUpdateRequest, VerificationResponse
│   │   ├── admin.py           # User management schemas, approval pipeline overview, official assignments
│   │   └── election.py        # Election creation, update, position models, eligibility criteria schemas
│   └── services/              # Business logic, query isolation, and external integrations
│       ├── __init__.py
│       ├── admin.py           # User administration queries, official assignments, and approvals stats
│       ├── csv_importer.py    # File parsing, header normalization, format validation, and batch ingestion
│       ├── elections.py       # Election lifecycle transitions, approvals, eligibility checks, and audit logging
│       ├── eligibility.py     # Dynamic election eligibility evaluation against departmental rules
│       ├── identity.py        # String normalization, name matching, and email validation logic
│       ├── student_records.py # Query utilities for official student entity retrieval
│       └── student_verification.py # Comparison engine matching application user with official student
├── migrations/                # Alembic database migration scripts
│   ├── env.py                 # Migration environment configuration registering SQLAlchemy metadata
│   ├── script.py.mako         # Migration generation template
│   └── versions/              # Migration revision files (001 through 009)
│       ├── 001_initial_create_users_and_students_tables.py
│       ├── 002_add_verification_fields.py
│       ├── 003_recreate_users_table.py
│       ├── 004_add_student_status.py
│       ├── 005_recreate_users_and_students_tables.py
│       ├── 006_student_import_audit.py
│       ├── 007_dashboard_stats_indexes.py
│       ├── 008_election_creation_and_configuration.py
│       └── 009_ensure_election_audit_logs.py
├── tests/                     # Automated test suite
│   ├── __init__.py
│   ├── test_identity_verification.py   # Unit tests for name normalization, email matching, identity comparison
│   ├── test_election_configuration.py  # Tests for election lifecycle, positions, and approval transitions
│   └── test_admin_management.py        # Tests for user listing, role changes, and admin approvals
├── alembic.ini                # Alembic CLI database migration configuration
├── requirements.txt           # Python package dependencies
├── .env                       # Backend environment configuration (git ignored)
└── .env.example               # Template environment configuration
```

---

## 3. Frontend Architecture (`frontend/`)

The frontend is a React 19 single-page application built with Vite and TypeScript:

```
frontend/
├── public/                    # Static assets (favicons, icons)
├── src/
│   ├── main.tsx               # Client entry point mounting App to DOM
│   ├── App.tsx                # Client-side router, route declarations, and layout wrappers
│   ├── index.css              # Global responsive styling, variables, theme tokens, and layouts
│   ├── assets/                # Visual media (banner.jpg, hero.png, vite.svg)
│   ├── auth/                  # Authentication infrastructure
│   │   ├── AuthContext.tsx    # Global React Context tracking Firebase user, loading state, and user profile
│   │   └── ProtectedRoute.tsx # Route guards: ProtectedRoute, RoleProtectedRoute, PublicOnlyRoute
│   ├── components/            # Reusable UI widgets
│   │   ├── Header.tsx         # Navigation bar with branding and active link states
│   │   ├── Footer.tsx         # Application footer with institutional details
│   │   ├── Loader.tsx         # Animated loading spinner component
│   │   ├── Loader.css         # Keyframe animations and spinner styles
│   │   └── LoadingScreen.tsx  # Fullscreen overlay shown during authentication transitions
│   ├── hooks/                 # Custom React hooks
│   │   └── useAuth.ts         # Hook exposing AuthContext state and helper methods
│   ├── lib/                   # External library wrappers
│   │   └── firebase.ts        # Firebase Client SDK initialization, OAuth providers, token retrieval
│   ├── pages/                 # Full-page views
│   │   ├── LoginPage.tsx              # Email/password and Google OAuth login view
│   │   ├── RegisterPage.tsx           # Student registration view
│   │   ├── ForgotPasswordPage.tsx     # Firebase password reset initiation
│   │   ├── VerifyEmailPage.tsx        # Email verification prompt and polling view
│   │   ├── DashboardPage.tsx          # Student voting dashboard (elections list, announcements)
│   │   ├── RoleDashboardPage.tsx      # Multi-role administrative dashboard layout (sidebar + dynamic panels)
│   │   ├── ProfilePage.tsx            # Student profile, verification status, and identity submission
│   │   ├── StudentManagementPage.tsx  # Staff roster view, search, and CSV/XLSX file upload modal
│   │   ├── ElectionsPage.tsx          # Election administration list with status filters
│   │   ├── ElectionWizardPage.tsx      # Multi-step wizard for election configuration and position setup
│   │   ├── ElectionDetailPage.tsx      # Single election overview, positions, approvals, and audit trail
│   │   └── ApprovalsPage.tsx          # Super Admin multi-stage approval queue
│   └── services/              # API Client
│       └── api.ts             # Centralized HTTP request layer with Firebase Bearer token injection
├── index.html                 # HTML template
├── package.json               # Frontend dependencies and build scripts
├── tsconfig.json              # TypeScript root configuration
├── tsconfig.app.json          # TypeScript client application compiler rules
├── tsconfig.node.json         # TypeScript Vite compiler rules
└── vite.config.ts             # Vite bundler configuration
```

---

## 4. Key Cross-Cutting Modules & Interactions

| Capability | Frontend Component(s) | Backend Router / Service | Database Tables |
|---|---|---|---|
| **User Sign-In & Sync** | `LoginPage.tsx`, `AuthContext.tsx` | `api/auth.py` (`sync_user`), `firebase_admin.py` | `users` |
| **Student Identity Verification** | `ProfilePage.tsx` | `api/auth.py` (`verify_student`), `services/student_verification.py` | `users`, `students` |
| **Official Roster Import** | `StudentManagementPage.tsx` | `api/students.py`, `services/csv_importer.py` | `students`, `student_imports` |
| **Super Admin Live Totals** | `RoleDashboardPage.tsx` | `api/auth.py` (`get_admin_dashboard_stats`), `services/admin.py` | `users`, `students` |
| **Election Setup & Wizard** | `ElectionWizardPage.tsx` | `api/elections.py`, `services/elections.py` | `elections`, `election_positions` |
| **Election Approvals Pipeline** | `ApprovalsPage.tsx` | `api/admin.py`, `services/admin.py` | `elections`, `election_approvals`, `election_audit_logs` |
| **User & Staff Role Control** | `RoleDashboardPage.tsx` | `api/admin.py`, `services/admin.py` | `users` |
