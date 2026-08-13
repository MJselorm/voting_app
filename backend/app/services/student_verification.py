from __future__ import annotations

from typing import NamedTuple

from app.models.student import Student
from app.models.user import User
from app.services.identity import names_match, verify_email_match


class IdentityComparisonResult(NamedTuple):
    verified: bool
    audit_reason: str


def compare_identity(user: User, official_student: Student | None) -> IdentityComparisonResult:
    """Compare application identity data with the authoritative student record.

    The reason is deliberately for audit logs only. API callers receive a single
    generic failure message so the official roster cannot be probed.
    """
    if not user.student_id or official_student is None:
        return IdentityComparisonResult(False, "student_record_not_found")
    if user.student_id != official_student.student_id:
        return IdentityComparisonResult(False, "student_id_mismatch")
    if not verify_email_match(user.email, official_student.email):
        return IdentityComparisonResult(False, "email_mismatch")
    if not names_match(user.full_name, official_student.full_name):
        return IdentityComparisonResult(False, "name_mismatch")
    return IdentityComparisonResult(True, "verified")
