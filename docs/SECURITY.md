# SECURITY.md — Security Architecture & Threat Mitigation Guide

## 1. Overview

UniVote handles sensitive institutional election data, requiring strict defenses against voter impersonation, privilege escalation, ballot stuffing, and unauthorized administrative actions.

## 2. Threat Modeling & Security Mitigations

### 2.1 Threat: Credential Theft & Password Database Leaks
- **Mitigation**: UniVote **never** stores passwords, password salts, or hashes in PostgreSQL. All credentials and authentication mechanisms are outsourced to **Firebase Authentication**, backed by Google's secure identity infrastructure.

### 2.2 Threat: Token Spoofing & Forged JWT Claims
- **Mitigation**: The backend enforces **Firebase Admin SDK** verification (`auth.verify_id_token(token)`). This verifies cryptographic digital signatures against Google's public certificates on every protected request. Local manual decoding of JWT payloads without signature verification is strictly prohibited.

### 2.3 Threat: Client-Side Role Tampering
- **Mitigation**: The browser application is considered untrusted. User roles, active statuses, and verification flags are never accepted from the client request body during self-registration or profile updates. FastAPI route dependencies (`require_admin`, `require_election_official`) query the verified database record independently.

### 2.4 Threat: Voter Impersonation & Fake Student IDs
- **Mitigation**: Self-registration does not grant voting rights. A user must complete **Student Identity Verification**, which cross-references the student ID, normalized legal name, and institutional email against an authoritative, pre-imported university roster (`students` table).

### 2.5 Threat: Student Roster Probing & Enumeration
- **Mitigation**: When verification fails, the API responds with a uniform, generic message (`"Student verification failed. Details do not match official records."`). Specific failure reasons (`name_mismatch`, `email_mismatch`, `record_not_found`) are restricted to internal server-side audit logs.

### 2.6 Threat: Election Tampering & Unauthorized Ballots
- **Mitigation**:
  - Elections follow a strict status machine (`DRAFT` → `OFFICIAL_REVIEW` → `SUPER_ADMIN_FINAL_APPROVAL` → `APPROVED`).
  - All configuration changes, reviews, approvals, and status transitions are written to an immutable audit ledger (`election_audit_logs`).
