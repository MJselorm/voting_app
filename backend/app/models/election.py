from __future__ import annotations

import enum
import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.database.base import Base

if TYPE_CHECKING:
    from app.models.user import User


class ElectionStatus(str, enum.Enum):
    """
    Lifecycle status of an election.

    DRAFT                       — Being drafted/configured; incomplete fields permitted.
    PENDING_APPROVAL            — Submitted by creator; awaiting official/admin reviews.
    OFFICIAL_REVIEW             — In review by assigned election officials.
    SUPER_ADMIN_FINAL_APPROVAL  — Reviewed by officials; awaiting Super Admin confirmation.
    APPROVED                    — Fully approved; ready for scheduling.
    SCHEDULED                   — Approved with confirmed future start time.
    LIVE                        — Voting is actively in progress.
    ENDED                       — Voting period has concluded.
    CANCELLED                   — Withdrawn or cancelled.
    """

    DRAFT = "DRAFT"
    PENDING_APPROVAL = "PENDING_APPROVAL"
    OFFICIAL_REVIEW = "OFFICIAL_REVIEW"
    SUPER_ADMIN_FINAL_APPROVAL = "SUPER_ADMIN_FINAL_APPROVAL"
    APPROVED = "APPROVED"
    SCHEDULED = "SCHEDULED"
    LIVE = "LIVE"
    ENDED = "ENDED"
    CANCELLED = "CANCELLED"


class ResultVisibility(str, enum.Enum):
    """
    Controls who can view vote tallies and when.

    HIDDEN_UNTIL_ENDED          — Results are private until voting completely ends.
    OFFICIALS_ONLY_DURING_VOTING — Live count is visible to assigned officials; revealed upon close.
    PUBLIC_LIVE                 — Real-time results and turnout visible to everyone.
    """

    HIDDEN_UNTIL_ENDED = "HIDDEN_UNTIL_ENDED"
    OFFICIALS_DURING_VOTING = "OFFICIALS_DURING_VOTING"
    PUBLIC_LIVE = "PUBLIC_LIVE"


class Election(Base):
    """
    Main election configuration and lifecycle container.

    Security & Privacy:
        - Eligibility rules are stored as structured JSON queries; student data is NOT duplicated.
        - Result visibility is an election-level setting to support varied institutional policies.
    """

    __tablename__ = "elections"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True,
    )

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    department: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
        default="Computer Science and Engineering",
        index=True,
    )
    election_type: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        default="Departmental Election",
    )

    # Schedule timestamps
    start_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    end_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Workflow & Visibility
    status: Mapped[ElectionStatus] = mapped_column(
        Enum(ElectionStatus, name="electionstatus"),
        nullable=False,
        default=ElectionStatus.DRAFT,
        index=True,
    )
    result_visibility: Mapped[ResultVisibility] = mapped_column(
        Enum(ResultVisibility, name="resultvisibility"),
        nullable=False,
        default=ResultVisibility.OFFICIALS_DURING_VOTING,
    )

    # Stored eligibility filter rules (e.g. {"departments": ["..."], "levels": ["200"], "statuses": ["ACTIVE"]})
    eligibility_criteria: Mapped[dict[str, Any]] = mapped_column(
        "eligibility_rules",
        JSONB,
        nullable=False,
        default=dict,
        server_default="{}",
    )

    # Creator (ownership)
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

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

    # Relationships
    creator: Mapped[User] = relationship("User", foreign_keys=[created_by])
    positions: Mapped[list[ElectionPosition]] = relationship(
        "ElectionPosition",
        back_populates="election",
        cascade="all, delete-orphan",
        order_by="ElectionPosition.display_order",
    )
    official_assignments: Mapped[list[ElectionOfficialAssignment]] = relationship(
        "ElectionOfficialAssignment",
        back_populates="election",
        cascade="all, delete-orphan",
    )
    approvals: Mapped[list[ElectionApproval]] = relationship(
        "ElectionApproval",
        back_populates="election",
        cascade="all, delete-orphan",
        order_by="ElectionApproval.created_at",
    )
    audit_logs: Mapped[list[ElectionAuditLog]] = relationship(
        "ElectionAuditLog",
        back_populates="election",
        cascade="all, delete-orphan",
        order_by="ElectionAuditLog.created_at",
    )

    def __repr__(self) -> str:
        return f"<Election id={self.id} name={self.name!r} status={self.status}>"


class ElectionPosition(Base):
    """
    Contested or nominated office within an election.
    """

    __tablename__ = "election_positions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True,
    )
    election_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("elections.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    display_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    number_of_winners: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    election: Mapped[Election] = relationship("Election", back_populates="positions")

    def __repr__(self) -> str:
        return f"<ElectionPosition id={self.id} name={self.name!r} winners={self.number_of_winners}>"


class ElectionOfficialAssignment(Base):
    """
    Junction table assigning an Election Official or Super Admin to a specific election.
    Preserves historical election assignments across academic years.
    """

    __tablename__ = "election_official_assignments"
    __table_args__ = (
        UniqueConstraint("election_id", "user_id", name="uq_election_official_assignment"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True,
    )
    election_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("elections.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    assigned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    election: Mapped[Election] = relationship("Election", back_populates="official_assignments")
    user: Mapped[User] = relationship("User")

    def __repr__(self) -> str:
        return f"<ElectionOfficialAssignment election_id={self.election_id} user_id={self.user_id}>"


class ElectionApproval(Base):
    """
    Recorded approval or rejection decision on an election.
    """

    __tablename__ = "election_approvals"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True,
    )
    election_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("elections.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    approval_status: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        comment="APPROVED, REJECTED, or REQUESTED_CHANGES",
    )
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    election: Mapped[Election] = relationship("Election", back_populates="approvals")
    user: Mapped[User] = relationship("User")

    def __repr__(self) -> str:
        return f"<ElectionApproval election_id={self.election_id} status={self.approval_status}>"


class ElectionAuditLog(Base):
    """
    Immutable audit trail for all election configuration & workflow lifecycle actions.
    """

    __tablename__ = "election_audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True,
    )
    election_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("elections.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    action: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    details: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        index=True,
    )

    election: Mapped[Election] = relationship("Election", back_populates="audit_logs")
    user: Mapped[User | None] = relationship("User")

    def __repr__(self) -> str:
        return f"<ElectionAuditLog action={self.action!r} election_id={self.election_id}>"
