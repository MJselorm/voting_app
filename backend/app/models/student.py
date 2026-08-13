from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.database.base import Base


class Student(Base):
    """
    Official student record.

    This table will eventually be populated from university CSV/Excel exports
    (Phase 2 — Student Verification).  During Phase 1 (Authentication),
    it exists structurally so that foreign-key relationships and queries
    can be designed now without a breaking migration later.

    Relationship to User:
        User.student_id  →  Student.student_id

    Phase 2 will add the CSV importer and enforce that a User's student_id
    must exist in this table before they can participate in elections.
    """

    __tablename__ = "students"

    # ── Primary Key ───────────────────────────────────────────────────────
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True,
    )

    # ── Identity ──────────────────────────────────────────────────────────
    student_id: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        nullable=False,
        index=True,
        comment="University-issued student ID (from official records)",
    )
    full_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    email: Mapped[str | None] = mapped_column(String(320), unique=True, nullable=True, index=True)

    # ── Academic ──────────────────────────────────────────────────────────
    # These fields map to typical university CSV export columns.
    department: Mapped[str | None] = mapped_column(String(255), nullable=True)
    level: Mapped[str | None] = mapped_column(String(50), nullable=True)
    # "class" is a reserved word in Python — use class_ and map it explicitly.
    class_: Mapped[str | None] = mapped_column("class", String(100), nullable=True)
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="ACTIVE",
        server_default="ACTIVE",
        comment="Official student status. Only ACTIVE students can verify or vote.",
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
        onupdate=func.now(),
    )

    def __repr__(self) -> str:
        return f"<Student student_id={self.student_id!r} name={self.full_name!r}>"
