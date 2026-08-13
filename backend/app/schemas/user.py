from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, field_validator

from app.models.user import UserRole


# ── Request schemas ───────────────────────────────────────────────────────────

class UserSyncRequest(BaseModel):
    """
    Payload sent by the frontend after Firebase authentication to ensure
    the PostgreSQL user record exists and is up to date.

    NOTE: The role is NOT accepted from the client — it is always forced
    to STUDENT by the backend.  Any role field submitted by the client
    is silently ignored.
    """

    full_name: str
    email: EmailStr
    student_id: str | None = None

    @field_validator("full_name")
    @classmethod
    def full_name_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Full name cannot be empty")
        return v.strip()

    @field_validator("student_id")
    @classmethod
    def student_id_stripped(cls, v: str | None) -> str | None:
        if v is not None:
            return v.strip() or None
        return None


class UserUpdateRequest(BaseModel):
    """
    Payload for updating profile details.
    Allows updating full_name and student_id.
    """

    full_name: str | None = None
    student_id: str | None = None

    @field_validator("full_name")
    @classmethod
    def full_name_not_empty(cls, v: str | None) -> str | None:
        if v is not None:
            if not v.strip():
                raise ValueError("Full name cannot be empty")
            return v.strip()
        return None

    @field_validator("student_id")
    @classmethod
    def student_id_stripped(cls, v: str | None) -> str | None:
        if v is not None:
            return v.strip() or None
        return None


class StudentVerificationRequest(BaseModel):
    """
    Payload for verifying student identity against official records.
    Client submits student_id.
    """

    student_id: str

    @field_validator("student_id")
    @classmethod
    def student_id_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Student ID is required")
        return v.strip()


# ── Response schemas ──────────────────────────────────────────────────────────


class UserResponse(BaseModel):
    """
    Safe user representation returned to the client.
    Contains NO sensitive fields (no firebase credentials, no password hashes).
    """

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    firebase_uid: str
    student_id: str | None
    full_name: str
    email: str
    role: UserRole
    is_active: bool
    is_verified: bool
    verified_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class UserSyncResponse(BaseModel):
    """Response returned after a successful sync operation."""

    model_config = ConfigDict(from_attributes=True)

    user: UserResponse
    created: bool  # True if a new record was created, False if existing was returned


class StudentVerificationResponse(BaseModel):
    """Response returned after an identity verification attempt."""

    model_config = ConfigDict(from_attributes=True)

    success: bool
    message: str
    is_verified: bool
    user: UserResponse


class EligibilityCheckRequest(BaseModel):
    """Payload for evaluating whether the authenticated student is eligible for a specific election."""

    department: str | None = None
    level: str | None = None
    class_: str | None = None

    @field_validator("department", "level", "class_")
    @classmethod
    def optional_strings_stripped(cls, v: str | None) -> str | None:
        if v is None:
            return None
        stripped = v.strip()
        return stripped or None


class EligibilityCheckResponse(BaseModel):
    """Response returned after evaluating election eligibility."""

    model_config = ConfigDict(from_attributes=True)

    is_eligible: bool
    reason: str
    user: UserResponse
    student: StudentResponse | None = None


class StudentResponse(BaseModel):
    """Safe representation of an official student record."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    student_id: str
    full_name: str | None = None
    email: str | None = None
    department: str | None = None
    level: str | None = None
    class_: str | None = None
    status: str
