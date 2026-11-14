# DEPLOYMENT.md — Deployment & Infrastructure Configuration Guide

## 1. Overview

UniVote is designed for modern cloud container and serverless deployments.

- **Frontend**: Static single-page application suitable for CDN hosting (Vercel, Netlify, Cloudflare Pages, AWS S3 / CloudFront).
- **Backend**: Asynchronous ASGI service deployable via Docker, AWS ECS/Fargate, Google Cloud Run, Railway, or VPS.
- **Database**: Managed Serverless PostgreSQL (Neon or Supabase).

---

## 2. Environment Variables

### 2.1 Backend (`backend/.env`)

```env
# ── Database ──────────────────────────────────────────────────────────
# Standard PostgreSQL connection string (Neon or Supabase)
DATABASE_URL=postgresql://user:password@ep-host.region.aws.neon.tech/neondb?sslmode=require

# ── Firebase Admin SDK ────────────────────────────────────────────────
FIREBASE_PROJECT_ID=univote-prod
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@univote-prod.iam.gserviceaccount.com
# Literal escaped private key string
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n"

# ── CORS & Institutional Settings ─────────────────────────────────────
ALLOWED_ORIGINS=https://univote.university.edu,http://localhost:5173
DEFAULT_ELIGIBLE_DEPARTMENT=Computer Science and Engineering
ALLOWED_EMAIL_DOMAINS=st.ug.edu.gh,ug.edu.gh
APP_ENV=production
```

### 2.2 Frontend (`frontend/.env`)

```env
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=univote-prod.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=univote-prod
VITE_FIREBASE_STORAGE_BUCKET=univote-prod.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789012
VITE_FIREBASE_APP_ID=1:123456789012:web:...
VITE_API_BASE_URL=https://api.univote.university.edu
```

---

## 3. Deployment Steps

### 3.1 Database Migration
Always run database migrations prior to launching updated application containers:
```bash
cd backend
alembic upgrade head
```

### 3.2 Backend Service (Uvicorn / Docker)
Run using production Uvicorn workers:
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

### 3.3 Frontend Build
```bash
cd frontend
npm ci
npm run build
# Upload 'dist/' directory to static host
```
