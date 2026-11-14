# ELIGIBILITY.md — Voter Eligibility Specification & Rules Engine

## 1. Overview

While identity verification establishes student authenticity, the **Eligibility Engine** evaluates whether a student qualifies to cast a ballot in a specific election based on institutional parameters (e.g., department, academic level, class cohort).

## 2. Evaluation Logic (`backend/app/services/eligibility.py`)

The function `check_election_eligibility()` executes four sequential checks:

```python
class EligibilityResult(NamedTuple):
    is_eligible: bool
    reason: str
```

### Check 1: User Account Status
The application account must be active.
- `if not user.is_active:` Returns `(False, "User account is inactive.")`.

### Check 2: Identity Verification Status
The user must have completed official student verification.
- `if not user.is_verified:` Returns `(False, "Student identity is not yet verified against official records.")`.

### Check 3: Authoritative Student Record & Status
The linked record in `students` must exist and be marked active.
- `if official_student is None:` Returns `(False, "No official student record found for this account.")`.
- `if not student_is_active(official_student):` Returns `(False, "Official student record is inactive.")`.

### Check 4: Election Target Criteria Matching
Compares the student's academic attributes with the election's target criteria (or institutional default):
- **Department**: Matches student's department against allowed departments (or `"all"` for university-wide SRC elections).
- **Academic Level**: (e.g. `200`, `300`, `400`).
- **Class / Cohort**: Specific class identifiers.

If any criterion fails, returns `(False, "Reason...")`. If all pass, returns `(True, "Student meets all eligibility requirements for this election.")`.

## 3. Estimating Voter Turnout (`services/elections.py`)

During election configuration in the Wizard (`ElectionWizardPage.tsx`), staff can simulate their eligibility criteria. The endpoint `POST /api/elections/estimate-eligibility` runs a database `COUNT()` of active students matching the proposed criteria and returns the expected voter pool size.
