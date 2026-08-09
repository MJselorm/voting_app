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

    firebase_uid: str
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
    created_at: datetime
    updated_at: datetime


class UserSyncResponse(BaseModel):
    """Response returned after a successful sync operation."""

    model_config = ConfigDict(from_attributes=True)

    user: UserResponse
    created: bool  # True if a new record was created, False if existing was returned
