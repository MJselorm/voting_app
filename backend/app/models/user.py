from __future__ import annotations

import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Enum, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.database.base import Base


class UserRole(str, enum.Enum):
    """
    Application-level roles.

    STUDENT          — Default role assigned to all new registrations.
    ELECTION_OFFICIAL — Can manage elections (assigned via admin operation).
    SUPER_ADMIN      — Full system access (assigned via admin operation).

    SECURITY: Users must never be able to self-assign any role other than STUDENT.
    Role promotion must happen through trusted backend/admin operations only.
    """

    STUDENT = "STUDENT"
    ELECTION_OFFICIAL = "ELECTION_OFFICIAL"
    SUPER_ADMIN = "SUPER_ADMIN"


class User(Base):
    """
    Application user record linked to a Firebase Authentication identity.

    Firebase owns the credential (email + password).
    This table owns application-level data (role, student ID, profile).

    The firebase_uid is the authoritative identifier that links this record
    to the Firebase user.  Passwords are NEVER stored here.
    """

    __tablename__ = "users"

    # ── Primary Key ───────────────────────────────────────────────────────
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True,
    )

    # ── Firebase identity ─────────────────────────────────────────────────
    firebase_uid: Mapped[str] = mapped_column(
        String(128),
        unique=True,
        nullable=False,
        index=True,
        comment="Firebase Authentication UID — never store passwords",
    )

    # ── Profile ───────────────────────────────────────────────────────────
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(320), unique=True, nullable=False, index=True)

    # ── Student linkage ───────────────────────────────────────────────────
    # Nullable because the link to an official student record is verified later.
    student_id: Mapped[str | None] = mapped_column(
        String(50),
        unique=True,
        nullable=True,
        index=True,
        comment="University student ID — verified against student records in Phase 2",
    )

    # ── Authorization ─────────────────────────────────────────────────────
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="userrole"),
        nullable=False,
        default=UserRole.STUDENT,
        comment="Application role — never trust values from the client",
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # ── Identity Verification ─────────────────────────────────────────────
    is_verified: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        comment="True once Student ID and university email are verified against official records",
    )
    verified_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Timestamp when identity verification succeeded",
    )

    # ── Timestamps ────────────────────────────────────────────────────────
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    def __repr__(self) -> str:
        return f"<User id={self.id} email={self.email!r} role={self.role}>"
