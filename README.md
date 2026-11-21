# UniVote authentication foundation

This foundation provides Firebase Authentication, a FastAPI REST API, and Neon PostgreSQL user and organization-onboarding data. Firebase manages passwords, Google sign-in, email verification, and password resets; the backend stores no passwords or Firebase credentials.

## Configure Firebase and Neon

1. In Firebase Console, enable **Email/Password** and **Google** sign-in, configure the verification and password-reset email templates, and allow `localhost` as an authorized domain.
2. Create a Neon database/branch for development. Copy its connection string and keep it private.
3. Configure the backend:
   ```powershell
   Copy-Item backend\.env.example backend\.env
   ```
   Set `DATABASE_URL` to the Neon connection string, `FIREBASE_PROJECT_ID` to your Firebase project ID, and `GOOGLE_APPLICATION_CREDENTIALS` to a private service-account JSON file path. On a hosting platform, prefer workload identity or its secret manager. Never commit the service-account file or `.env`.
4. Configure the Firebase web app:
   ```powershell
   Copy-Item frontend\.env.example frontend\.env
   ```
   Fill in the Firebase Web app values and keep `VITE_API_BASE_URL` pointed at the FastAPI origin. Firebase web configuration is public; do not put Admin credentials or `DATABASE_URL` in the frontend.

## Credential security and incident response

Firebase service-account JSON files are secrets. They are excluded by `.gitignore` and must stay outside the repository; use a private path for `GOOGLE_APPLICATION_CREDENTIALS`, a deployment secret for `FIREBASE_SERVICE_ACCOUNT_JSON`, or workload identity in production.

If a service-account file is exposed, assume it is compromised: remove it from the checkout, disable/delete the exposed key in **Google Cloud Console → IAM & Admin → Service Accounts → Keys**, create and deploy a replacement only if workload identity is unavailable, update the secret store, and review Cloud Audit Logs for unexpected use. Removing a file from a commit does not revoke a previously exposed key.

## Run locally

Backend, from the repository root:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
# Confirm DATABASE_URL targets an isolated development/staging branch, never production.
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

Frontend, in a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

The API is served at `http://127.0.0.1:8000`; Vite uses `http://localhost:5173`. Set `CORS_ORIGINS` if the frontend is hosted elsewhere.

## Tests

Backend tests use a fresh in-memory SQLite database and mocked Firebase tokens; they never connect to Neon:

```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest
```

Frontend component and API tests plus the production build:

```powershell
cd frontend
npm test
npm run build
```

## Frontend architecture

The React application is organized by feature. `frontend/src/app/` owns routing and providers; `features/auth/` owns authentication; `features/organizations/` includes organisation discovery, requests, membership workflows, and the Platform Super Admin console for organisation, user-role, audit, and setting management. Shared UI, navigation, and infrastructure live in `components/` and `lib/`. Elections, candidates, voting, polls, and results remain route placeholders.

The auth provider owns Firebase session state, while TanStack Query caches backend user profiles. Forms use React Hook Form and Zod; feature routes are lazy-loaded. Backend authorization remains authoritative.

## Scope

This foundation includes registration, email verification, email/password and Google login, password reset, session restoration, protected routes, profile viewing and full-name updates, and confirmed account deletion. The profile endpoints are `GET`, `PATCH`, and `DELETE /api/v1/users/me`; account deletion requires recent Firebase reauthentication. Organisation membership, Platform Super Admin, management assignment, and lifecycle behavior is documented in [docs/ORGANIZATION_MANAGEMENT.md](./docs/ORGANIZATION_MANAGEMENT.md). Invitations, elections, polls, and voting are not implemented.

## Current status

Authentication and the organization backend foundation have isolated tests. Live Firebase operations and the organization migration against Neon remain outstanding until real credentials and an approved isolated database branch are configured.
