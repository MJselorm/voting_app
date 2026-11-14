# TESTING.md — Testing Strategy & Execution Guide

## 1. Overview

UniVote maintains comprehensive automated unit and integration tests covering identity normalization, student verification algorithms, voter eligibility, election configuration lifecycles, and administrative governance.

## 2. Backend Test Architecture (`backend/tests/`)

Tests are executed with **Pytest** and an in-memory or isolated test database:

- **`test_identity_verification.py`**:
  - Tests `names_match()` with irregular whitespace, tab characters, and casing variations.
  - Tests `verify_email_match()` with uppercase and mixed domains.
  - Tests `compare_identity()` for matching active students, missing records, mismatched emails, and inactive roster entries.
- **`test_election_configuration.py`**:
  - Validates election creation with valid and invalid date intervals (`start_at >= end_at`).
  - Tests contested position creation and winner counts (`number_of_winners >= 1`).
  - Verifies approval pipeline status transitions (`DRAFT` → `OFFICIAL_REVIEW` → `SUPER_ADMIN_FINAL_APPROVAL` → `APPROVED`).
  - Verifies rejection feedback recording.
- **`test_admin_management.py`**:
  - Tests user search and filtering by role and verification status.
  - Tests role promotion and demotion.
  - Verifies account deactivation and authorization rejection.

## 3. Running Tests

### Backend Unit Tests
From the `backend` folder:
```bash
pytest tests/ -v
```

### Full Codebase Compilation Check
```bash
# Backend compilation
cd backend
python -m compileall -q app

# Frontend build & typecheck
cd ../frontend
npm run build
```
