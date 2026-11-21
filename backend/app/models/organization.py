import uuid
from datetime import datetime
from enum import Enum
from typing import Any

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum as SqlEnum,
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

from app.database.base import Base


class OrganizationType(str, Enum):
    UNIVERSITY = "UNIVERSITY"
    DEPARTMENT = "DEPARTMENT"
    COMPANY = "COMPANY"
    ASSOCIATION = "ASSOCIATION"
    CLUB = "CLUB"
    OTHER = "OTHER"


class OrganizationStatus(str, Enum):
    PENDING_APPROVAL = "PENDING_APPROVAL"
    ACTIVE = "ACTIVE"
    REJECTED = "REJECTED"
    SUSPENDED = "SUSPENDED"
    ARCHIVED = "ARCHIVED"


class OrganizationRequestStatus(str, Enum):
    PENDING_APPROVAL = "PENDING_APPROVAL"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class OrganizationManagementRole(str, Enum):
    OWNER = "ORGANISATION_OWNER"
    ADMIN = "ORGANISATION_ADMIN"


class OrganizationManagementMode(str, Enum):
    RETAIN_PLATFORM_MANAGEMENT = "RETAIN_PLATFORM_MANAGEMENT"
    ASSIGN_OWNER = "ASSIGN_OWNER"


class MembershipRequestStatus(str, Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class MembershipStatus(str, Enum):
    ACTIVE = "ACTIVE"
    SUSPENDED = "SUSPENDED"
    REMOVED = "REMOVED"


class MembershipVerificationMode(str, Enum):
    NONE = "NONE"
    INSTITUTIONAL_EMAIL = "INSTITUTIONAL_EMAIL"
    ADMIN_REVIEW = "ADMIN_REVIEW"


class MembershipVerificationStatus(str, Enum):
    PENDING = "PENDING"
    VERIFIED = "VERIFIED"
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"


class OrganizationInvitationStatus(str, Enum):
    PENDING = "PENDING"
    ACCEPTED = "ACCEPTED"
    EXPIRED = "EXPIRED"
    REVOKED = "REVOKED"


class NotificationDeliveryStatus(str, Enum):
    SENT = "SENT"
    NOT_CONFIGURED = "NOT_CONFIGURED"
    FAILED = "FAILED"
    NO_RECIPIENT = "NO_RECIPIENT"


def enum_values(enum_type: type[Enum]) -> list[str]:
    return [member.value for member in enum_type]


def enum_column(enum_type: type[Enum], name: str) -> SqlEnum:
    return SqlEnum(
        enum_type,
        name=name,
        native_enum=False,
        values_callable=enum_values,
        create_constraint=True,
    )


class Organization(Base):
    __tablename__ = "organizations"
    __table_args__ = (
        UniqueConstraint("slug", name="uq_organizations_slug"),
        Index("ix_organizations_status_created_at", "status", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    organization_type: Mapped[OrganizationType] = mapped_column(
        enum_column(OrganizationType, "organization_type"),
        nullable=False,
    )
    logo_url: Mapped[str | None] = mapped_column(String(500))
    contact_email: Mapped[str | None] = mapped_column(String(320))
    contact_phone: Mapped[str | None] = mapped_column(String(40))
    website: Mapped[str | None] = mapped_column(String(500))
    is_public_profile: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default=text("TRUE"))
    country: Mapped[str] = mapped_column(String(100), nullable=False)
    status: Mapped[OrganizationStatus] = mapped_column(
        enum_column(OrganizationStatus, "organization_status"),
        nullable=False,
        default=OrganizationStatus.ACTIVE,
        server_default=OrganizationStatus.ACTIVE.value,
    )
    membership_requires_approval: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default=text("TRUE")
    )
    membership_requires_invitation: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=text("FALSE")
    )
    membership_verification_mode: Mapped[MembershipVerificationMode] = mapped_column(
        enum_column(
            MembershipVerificationMode,
            "organization_membership_verification_mode",
        ),
        nullable=False,
        default=MembershipVerificationMode.NONE,
        server_default=MembershipVerificationMode.NONE.value,
    )
    membership_verified_email_domains: Mapped[list[str]] = mapped_column(
        JSON, nullable=False, default=list, server_default=text("'[]'")
    )
    membership_verification_instructions: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    approved_by: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
    )
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    created_by_user: Mapped["User"] = relationship(
        foreign_keys=[created_by], back_populates="created_organizations"
    )
    approved_by_user: Mapped["User | None"] = relationship(
        foreign_keys=[approved_by], back_populates="approved_organizations"
    )
    management_assignments: Mapped[list["OrganizationManagementAssignment"]] = (
        relationship(back_populates="organization", cascade="all, delete-orphan")
    )


class OrganizationRequest(Base):
    __tablename__ = "organization_requests"
    __table_args__ = (
        Index("ix_organization_requests_status_created_at", "status", "created_at"),
        Index("ix_organization_requests_requested_by", "requested_by"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    organization_type: Mapped[OrganizationType] = mapped_column(
        enum_column(OrganizationType, "organization_request_type"),
        nullable=False,
    )
    description: Mapped[str | None] = mapped_column(Text)
    logo_url: Mapped[str | None] = mapped_column(String(500))
    contact_email: Mapped[str | None] = mapped_column(String(320))
    contact_phone: Mapped[str | None] = mapped_column(String(40))
    website: Mapped[str | None] = mapped_column(String(500))
    country: Mapped[str] = mapped_column(String(100), nullable=False)
    supporting_information: Mapped[str | None] = mapped_column(Text)
    status: Mapped[OrganizationRequestStatus] = mapped_column(
        enum_column(OrganizationRequestStatus, "organization_request_status"),
        nullable=False,
        default=OrganizationRequestStatus.PENDING_APPROVAL,
        server_default=OrganizationRequestStatus.PENDING_APPROVAL.value,
    )
    rejection_reason: Mapped[str | None] = mapped_column(Text)
    requested_by: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
    )
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    organization_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("organizations.id", ondelete="SET NULL"),
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    requester: Mapped["User | None"] = relationship(
        foreign_keys=[requested_by], back_populates="organization_requests"
    )
    reviewer: Mapped["User | None"] = relationship(
        foreign_keys=[reviewed_by], back_populates="reviewed_organization_requests"
    )
    organization: Mapped[Organization | None] = relationship(
        foreign_keys=[organization_id]
    )


class OrganizationManagementAssignment(Base):
    __tablename__ = "organization_management_assignments"
    __table_args__ = (
        UniqueConstraint(
            "organization_id", "user_id", name="uq_org_management_org_user"
        ),
        Index("ix_org_management_user_role", "user_id", "role"),
        Index(
            "uq_org_management_single_owner",
            "organization_id",
            unique=True,
            sqlite_where=text("role = 'ORGANISATION_OWNER'"),
            postgresql_where=text("role = 'ORGANISATION_OWNER'"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("organizations.id", name="fk_org_mgmt_org", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    role: Mapped[OrganizationManagementRole] = mapped_column(
        enum_column(OrganizationManagementRole, "organization_management_role"),
        nullable=False,
    )
    assigned_by: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    organization: Mapped[Organization] = relationship(
        back_populates="management_assignments"
    )
    user: Mapped["User"] = relationship(
        foreign_keys=[user_id], back_populates="organization_management_assignments"
    )
    assigned_by_user: Mapped["User | None"] = relationship(
        foreign_keys=[assigned_by]
    )


class OrganizationMembership(Base):
    __tablename__ = "organization_memberships"
    __table_args__ = (
        UniqueConstraint(
            "organization_id", "user_id", name="uq_org_membership_org_user"
        ),
        Index("ix_org_membership_user_status", "user_id", "status"),
        Index("ix_org_membership_org_status", "organization_id", "status"),
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
    status: Mapped[MembershipStatus] = mapped_column(
        enum_column(MembershipStatus, "organization_membership_status"),
        nullable=False,
        default=MembershipStatus.ACTIVE,
        server_default=MembershipStatus.ACTIVE.value,
    )
    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    organization: Mapped[Organization] = relationship()
    user: Mapped["User"] = relationship(
        foreign_keys=[user_id], back_populates="organization_memberships"
    )
    reviewer: Mapped["User | None"] = relationship(
        foreign_keys=[reviewed_by]
    )


class OrganizationMembershipRequest(Base):
    __tablename__ = "organization_membership_requests"
    __table_args__ = (
        Index(
            "uq_org_membership_request_pending",
            "organization_id",
            "user_id",
            unique=True,
            sqlite_where=text("status = 'PENDING'"),
            postgresql_where=text("status = 'PENDING'"),
        ),
        Index("ix_org_membership_request_status", "status", "created_at"),
        Index("ix_org_membership_request_org_status", "organization_id", "status"),
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
    status: Mapped[MembershipRequestStatus] = mapped_column(
        enum_column(MembershipRequestStatus, "organization_membership_request_status"),
        nullable=False,
        default=MembershipRequestStatus.PENDING,
        server_default=MembershipRequestStatus.PENDING.value,
    )
    message: Mapped[str | None] = mapped_column(Text)
    membership_requires_approval: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default=text("TRUE")
    )
    membership_requires_invitation: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=text("FALSE")
    )
    verification_mode: Mapped[MembershipVerificationMode] = mapped_column(
        enum_column(
            MembershipVerificationMode,
            "membership_request_verification_mode",
        ),
        nullable=False,
        default=MembershipVerificationMode.NONE,
        server_default=MembershipVerificationMode.NONE.value,
    )
    verified_email_domains: Mapped[list[str]] = mapped_column(
        JSON, nullable=False, default=list, server_default=text("'[]'")
    )
    invitation_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey(
            "organization_invitations.id",
            name="fk_org_membership_request_invitation",
            ondelete="SET NULL",
        ),
    )
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    rejection_reason: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    organization: Mapped[Organization] = relationship()
    user: Mapped["User"] = relationship(
        foreign_keys=[user_id], back_populates="organization_membership_requests"
    )
    reviewer: Mapped["User | None"] = relationship(
        foreign_keys=[reviewed_by]
    )


class OrganizationInvitation(Base):
    __tablename__ = "organization_invitations"
    __table_args__ = (
        UniqueConstraint("token_hash", name="uq_org_invitation_token_hash"),
        Index(
            "uq_org_invitation_pending_email",
            "organization_id",
            "email",
            unique=True,
            sqlite_where=text("status = 'PENDING'"),
            postgresql_where=text("status = 'PENDING'"),
        ),
        Index(
            "ix_org_invitation_status_expires",
            "organization_id",
            "status",
            "expires_at",
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
    email: Mapped[str] = mapped_column(String(320), nullable=False)
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[OrganizationInvitationStatus] = mapped_column(
        enum_column(OrganizationInvitationStatus, "organization_invitation_status"),
        nullable=False,
        default=OrganizationInvitationStatus.PENDING,
        server_default=OrganizationInvitationStatus.PENDING.value,
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    invited_by: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
    accepted_by: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    membership_requires_approval: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default=text("TRUE")
    )
    verification_mode: Mapped[MembershipVerificationMode] = mapped_column(
        enum_column(
            MembershipVerificationMode,
            "organization_invitation_verification_mode",
        ),
        nullable=False,
        default=MembershipVerificationMode.NONE,
        server_default=MembershipVerificationMode.NONE.value,
    )
    verified_email_domains: Mapped[list[str]] = mapped_column(
        JSON, nullable=False, default=list, server_default=text("'[]'")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class OrganizationMembershipVerification(Base):
    __tablename__ = "organization_membership_verifications"
    __table_args__ = (
        Index(
            "uq_org_membership_verification_pending",
            "organization_id",
            "user_id",
            unique=True,
            sqlite_where=text("status = 'PENDING'"),
            postgresql_where=text("status = 'PENDING'"),
        ),
        Index(
            "ix_org_membership_verification_org_status",
            "organization_id",
            "status",
            "created_at",
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
    membership_request_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("organization_membership_requests.id", ondelete="SET NULL"),
    )
    invitation_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("organization_invitations.id", ondelete="SET NULL"),
    )
    verification_mode: Mapped[MembershipVerificationMode] = mapped_column(
        enum_column(
            MembershipVerificationMode,
            "organization_membership_verification_request_mode",
        ),
        nullable=False,
    )
    status: Mapped[MembershipVerificationStatus] = mapped_column(
        enum_column(
            MembershipVerificationStatus,
            "organization_membership_verification_status",
        ),
        nullable=False,
        default=MembershipVerificationStatus.PENDING,
        server_default=MembershipVerificationStatus.PENDING.value,
    )
    membership_requires_approval: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default=text("TRUE")
    )
    verified_email_domains: Mapped[list[str]] = mapped_column(
        JSON, nullable=False, default=list, server_default=text("'[]'")
    )
    submission_note: Mapped[str | None] = mapped_column(Text)
    rejection_reason: Mapped[str | None] = mapped_column(Text)
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class OrganizationAuditLog(Base):
    __tablename__ = "organization_audit_logs"
    __table_args__ = (
        Index("ix_organization_audit_org_created_at", "organization_id", "created_at"),
        Index("ix_organization_audit_request_created_at", "request_id", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    organization_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("organizations.id", ondelete="SET NULL")
    )
    request_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("organization_requests.id", ondelete="SET NULL")
    )
    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
    action: Mapped[str] = mapped_column(String(60), nullable=False)
    details: Mapped[dict[str, Any]] = mapped_column(
        JSON, nullable=False, default=dict, server_default=text("'{}'")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    organization: Mapped[Organization | None] = relationship()
    request: Mapped[OrganizationRequest | None] = relationship()
    actor: Mapped["User | None"] = relationship(
        foreign_keys=[actor_user_id], back_populates="organization_audit_events"
    )
