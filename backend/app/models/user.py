import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, String, Uuid, func, text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.orm import relationship

from app.database.base import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    firebase_uid: Mapped[str] = mapped_column(
        String(128),
        nullable=False,
        unique=True,
    )
    full_name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(320), nullable=False, unique=True)
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default=text("true"),
    )
    is_platform_super_admin: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default=text("false"),
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
        onupdate=func.now(),
    )

    created_organizations: Mapped[list["Organization"]] = relationship(
        foreign_keys="Organization.created_by", back_populates="created_by_user"
    )
    approved_organizations: Mapped[list["Organization"]] = relationship(
        foreign_keys="Organization.approved_by", back_populates="approved_by_user"
    )
    organization_requests: Mapped[list["OrganizationRequest"]] = relationship(
        foreign_keys="OrganizationRequest.requested_by", back_populates="requester"
    )
    reviewed_organization_requests: Mapped[
        list["OrganizationRequest"]
    ] = relationship(
        foreign_keys="OrganizationRequest.reviewed_by", back_populates="reviewer"
    )
    organization_management_assignments: Mapped[
        list["OrganizationManagementAssignment"]
    ] = relationship(
        foreign_keys="OrganizationManagementAssignment.user_id",
        back_populates="user",
    )
    organization_audit_events: Mapped[list["OrganizationAuditLog"]] = relationship(
        foreign_keys="OrganizationAuditLog.actor_user_id", back_populates="actor"
    )
    platform_role_assignments: Mapped[list["PlatformRoleAssignment"]] = relationship(
        foreign_keys="PlatformRoleAssignment.user_id", back_populates="user"
    )
    organization_role_assignments: Mapped[list["OrganizationRoleAssignment"]] = relationship(
        foreign_keys="OrganizationRoleAssignment.user_id", back_populates="user"
    )
    organization_memberships: Mapped[list["OrganizationMembership"]] = relationship(
        foreign_keys="OrganizationMembership.user_id", back_populates="user"
    )
    organization_membership_requests: Mapped[list["OrganizationMembershipRequest"]] = relationship(
        foreign_keys="OrganizationMembershipRequest.user_id", back_populates="user"
    )
