import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Index,
    JSON,
    String,
    Text,
    UniqueConstraint,
    Uuid,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.auth.permissions import AssignmentStatus, OrganizationRole, PlatformRole
from app.database.base import Base
from app.models.organization import enum_column

if TYPE_CHECKING:
    from app.models.organization import Organization
    from app.models.user import User


class PlatformRoleAssignment(Base):
    __tablename__ = "platform_role_assignments"
    __table_args__ = (
        Index("ix_platform_role_user_status", "user_id", "status"),
        Index("ix_platform_role_role_status", "role", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    role: Mapped[PlatformRole] = mapped_column(
        enum_column(PlatformRole, "platform_role"),
        nullable=False,
        default=PlatformRole.PLATFORM_SUPER_ADMIN,
    )
    status: Mapped[AssignmentStatus] = mapped_column(
        enum_column(AssignmentStatus, "platform_assignment_status"),
        nullable=False,
        default=AssignmentStatus.ACTIVE,
        server_default=AssignmentStatus.ACTIVE.value,
    )
    assigned_by: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
    )
    assigned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    user: Mapped["User"] = relationship(
        foreign_keys=[user_id], back_populates="platform_role_assignments"
    )
    assigned_by_user: Mapped["User | None"] = relationship(foreign_keys=[assigned_by])


class OrganizationRoleAssignment(Base):
    __tablename__ = "organization_role_assignments"
    __table_args__ = (
        Index(
            "ix_org_role_org_user_status",
            "organization_id",
            "user_id",
            "status",
        ),
        Index("ix_org_role_user_status", "user_id", "status"),
        Index(
            "uq_org_single_active_owner",
            "organization_id",
            unique=True,
            sqlite_where=text(
                "role = 'ORGANISATION_OWNER' AND status = 'ACTIVE'"
            ),
            postgresql_where=text(
                "role = 'ORGANISATION_OWNER' AND status = 'ACTIVE'"
            ),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    role: Mapped[OrganizationRole] = mapped_column(
        enum_column(OrganizationRole, "organization_role"),
        nullable=False,
    )
    status: Mapped[AssignmentStatus] = mapped_column(
        enum_column(AssignmentStatus, "org_assignment_status"),
        nullable=False,
        default=AssignmentStatus.ACTIVE,
        server_default=AssignmentStatus.ACTIVE.value,
    )
    assigned_by: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
    )
    assigned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    organization: Mapped["Organization"] = relationship()
    user: Mapped["User"] = relationship(
        foreign_keys=[user_id], back_populates="organization_role_assignments"
    )
    assigned_by_user: Mapped["User | None"] = relationship(foreign_keys=[assigned_by])


class PlatformSetting(Base):
    __tablename__ = "platform_settings"

    key: Mapped[str] = mapped_column(String(100), primary_key=True)
    value: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(String(255))
    updated_by: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
