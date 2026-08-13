from __future__ import annotations

import uuid
import asyncio
import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from app.auth.dependencies import get_verified_firebase_token
from app.models.student import Student
from app.models.user import User, UserRole
from app.services.identity import names_match, normalize_name, verify_email_match
from app.services.eligibility import check_election_eligibility
from app.services.student_verification import compare_identity
from app.schemas.user import UserSyncRequest


# ── TEST 1: Valid Student ID + matching email + matching name → SUCCESS ──────
def test_identity_matching_success():
    name1 = "John Mensah"
    name2 = "  john   mensah "
    email1 = "john@university.edu"
    email2 = "JOHN@UNIVERSITY.EDU"

    assert names_match(name1, name2) is True
    assert verify_email_match(email1, email2) is True


def test_identity_comparison_verifies_active_matching_student():
    user = User(
        id=uuid.uuid4(), firebase_uid="uid_match", full_name="  john   mensah ",
        email="JOHN@university.edu", student_id="CSE2024001", role=UserRole.STUDENT,
        is_active=True, is_verified=False,
    )
    official_student = Student(
        id=uuid.uuid4(), student_id="CSE2024001", full_name="John Mensah",
        email="john@university.edu", department="Computer Science and Engineering",
        level="200", class_="CSE-A", status="ACTIVE",
    )

    assert compare_identity(user, official_student).verified is True


# ── TEST 2: Valid Student ID + wrong email → REJECT ─────────────────────────
def test_identity_matching_wrong_email():
    official_email = "john@university.edu"
    provided_email = "attacker@gmail.com"

    assert verify_email_match(provided_email, official_email) is False


def test_identity_comparison_rejects_nonexistent_student():
    user = User(
        id=uuid.uuid4(), firebase_uid="uid_missing", full_name="John Mensah",
        email="john@university.edu", student_id="CSE9999999", role=UserRole.STUDENT,
        is_active=True, is_verified=False,
    )
    result = compare_identity(user, None)
    assert result.verified is False
    assert result.audit_reason == "student_record_not_found"


# ── TEST 3: Valid Student ID + wrong name → REJECT ──────────────────────────
def test_identity_matching_wrong_name():
    official_name = "John Mensah"
    provided_name = "Peter Mensah"

    assert names_match(provided_name, official_name) is False


def test_identity_comparison_allows_matching_inactive_student():
    user = User(
        id=uuid.uuid4(), firebase_uid="uid_inactive", full_name="John Mensah",
        email="john@university.edu", student_id="CSE2024001", role=UserRole.STUDENT,
        is_active=True, is_verified=True,
    )
    official_student = Student(
        id=uuid.uuid4(), student_id="CSE2024001", full_name="John Mensah",
        email="john@university.edu", department="Computer Science and Engineering",
        level="200", class_="CSE-A", status="INACTIVE",
    )
    result = compare_identity(user, official_student)
    assert result.verified is True

    eligibility = check_election_eligibility(
        user,
        official_student,
        target_criteria={"department": "Computer Science and Engineering"},
    )
    assert eligibility.is_eligible is False
    assert "inactive" in eligibility.reason.lower()


# ── TEST 4 & 5: Name Normalization Edge Cases ────────────────────────────────
def test_name_normalization():
    assert normalize_name("  Jane   Amoah  ") == "jane amoah"
    assert normalize_name("JANE AMOAH") == "jane amoah"
    assert normalize_name("") == ""
    assert normalize_name(None) == ""


# ── TEST 6: Valid CSE Student Eligibility ────────────────────────────────────
def test_cse_student_eligibility():
    user = User(
        id=uuid.uuid4(),
        firebase_uid="uid_cse_001",
        full_name="Kwame Asante",
        email="kwame@university.edu",
        student_id="CSE001",
        role=UserRole.STUDENT,
        is_active=True,
        is_verified=True,
    )
    official_student = Student(
        id=uuid.uuid4(),
        student_id="CSE001",
        full_name="Kwame Asante",
        email="kwame@university.edu",
        department="Computer Science and Engineering",
        level="300",
        class_="CSE-A",
        status="ACTIVE",
    )

    result = check_election_eligibility(
        user,
        official_student,
        target_criteria={"department": "Computer Science and Engineering"},
    )
    assert result.is_eligible is True
    assert "Eligible" in result.reason


# ── TEST 7: Valid student from another department → verified, but NOT eligible for CSE election ──
def test_other_department_student_ineligible_for_cse_election():
    user = User(
        id=uuid.uuid4(),
        firebase_uid="uid_ee_001",
        full_name="Ama Osei",
        email="ama@university.edu",
        student_id="EE001",
        role=UserRole.STUDENT,
        is_active=True,
        is_verified=True,
    )
    official_student = Student(
        id=uuid.uuid4(),
        student_id="EE001",
        full_name="Ama Osei",
        email="ama@university.edu",
        department="Electrical Engineering",
        level="200",
        status="ACTIVE",
    )

    result = check_election_eligibility(
        user,
        official_student,
        target_criteria={"department": "Computer Science and Engineering"},
    )
    assert result.is_eligible is False
    assert "restricted to Computer Science and Engineering" in result.reason


# ── TEST 8: Unverified student attempting election → REJECT ──────────────────
def test_unverified_student_ineligible():
    user = User(
        id=uuid.uuid4(),
        firebase_uid="uid_unverified",
        full_name="Kofi Boateng",
        email="kofi@university.edu",
        role=UserRole.STUDENT,
        is_active=True,
        is_verified=False,  # Unverified
    )
    official_student = Student(
        id=uuid.uuid4(),
        student_id="CSE002",
        full_name="Kofi Boateng",
        email="kofi@university.edu",
        department="Computer Science and Engineering",
    )

    result = check_election_eligibility(
        user,
        official_student,
        target_criteria={"department": "Computer Science and Engineering"},
    )
    assert result.is_eligible is False
    assert "not yet verified" in result.reason


# ── TEST 9 & 10: Client Payload Manipulation Safety ─────────────────────────
def test_client_payload_cannot_set_role_or_verification():
    req = UserSyncRequest(
        full_name="Test User",
        email="test@university.edu",
        student_id="CSE999",
        role="SUPER_ADMIN",
        is_verified=True,
        department="Computer Science and Engineering",
    )

    assert not hasattr(req, "is_verified")
    assert not hasattr(req, "role")
    assert not hasattr(req, "firebase_uid")


def test_missing_firebase_token_is_rejected():
    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(get_verified_firebase_token(None))
    assert exc_info.value.status_code == 401


def test_invalid_firebase_token_is_rejected(monkeypatch):
    async def reject_token(_: str) -> dict:
        raise ValueError("invalid token")

    monkeypatch.setattr("app.auth.dependencies.verify_firebase_token", reject_token)
    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials="invalid-token")

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(get_verified_firebase_token(credentials))
    assert exc_info.value.status_code == 401
