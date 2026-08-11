from __future__ import annotations

from typing import Any, NamedTuple

from app.core.config import settings
from app.models.student import Student
from app.models.user import User


class EligibilityResult(NamedTuple):
    is_eligible: bool
    reason: str


def check_election_eligibility(
    user: User,
    official_student: Student | None,
    target_criteria: dict[str, Any] | None = None,
) -> EligibilityResult:
    """
    Evaluate whether a user is eligible to participate in a given election.

    Decouples Identity Verification from Election Eligibility:
        - Identity Verification answers: "Is this a valid, verified student account?"
        - Election Eligibility answers: "Is this student allowed to vote in THIS specific election?"

    Modular Targeting:
        - Default CSE MVP criteria target department: "Computer Science and Engineering".
        - Flexible target_criteria support department, level, class, or "all" (SRC university-wide).
    """
    # ── Check 1: User Account Status ──────────────────────────────────────────
    if not user.is_active:
        return EligibilityResult(False, "User account is inactive.")

    # ── Check 2: Identity Verification Status ────────────────────────────────
    if not user.is_verified:
        return EligibilityResult(False, "Student identity is not yet verified against official records.")

    # ── Check 3: Official Student Record Linkage ──────────────────────────────
    if official_student is None:
        return EligibilityResult(False, "No official student record found for this account.")

    # If no specific election target criteria provided, default to department check for CSE MVP
    if not target_criteria:
        target_criteria = {"department": settings.DEFAULT_ELIGIBLE_DEPARTMENT}

    # ── Check 4: Department Criteria ─────────────────────────────────────────
    required_department = target_criteria.get("department")
    if required_department and required_department.lower() != "all":
        student_dept = (official_student.department or "").strip()
        if student_dept.lower() != required_department.lower():
            return EligibilityResult(
                False,
                f"Election is restricted to {required_department} students. "
                f"Your official department is '{student_dept or 'Unassigned'}'.",
            )

    # ── Check 5: Academic Level Criteria ─────────────────────────────────────
    required_level = target_criteria.get("level")
    if required_level and required_level.lower() != "all":
        student_level = (official_student.level or "").strip()
        if student_level.lower() != required_level.lower():
            return EligibilityResult(
                False,
                f"Election is restricted to Level {required_level} students. "
                f"Your official level is '{student_level or 'Unassigned'}'.",
            )

    # ── Check 6: Class Group Criteria ─────────────────────────────────────────
    required_class = target_criteria.get("class")
    if required_class and required_class.lower() != "all":
        student_class = (official_student.class_ or "").strip()
        if student_class.lower() != required_class.lower():
            return EligibilityResult(
                False,
                f"Election is restricted to Class '{required_class}'. "
                f"Your official class is '{student_class or 'Unassigned'}'.",
            )

    return EligibilityResult(True, "Eligible to vote.")
