import uuid
from datetime import datetime
import re
from urllib.parse import urlparse

from pydantic import BaseModel, ConfigDict, Field, computed_field, field_validator, model_validator

from app.models.organization import (
    OrganizationManagementMode,
    OrganizationManagementRole,
    OrganizationInvitationStatus,
    OrganizationRequestStatus,
    OrganizationStatus,
    OrganizationType,
    MembershipRequestStatus,
    MembershipStatus,
    MembershipVerificationMode,
    MembershipVerificationStatus,
    NotificationDeliveryStatus,
)


class OrganizationDetailsInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=2, max_length=255)
    organization_type: OrganizationType
    description: str | None = Field(default=None, max_length=5000)
    contact_email: str | None = Field(default=None, max_length=320)
    contact_phone: str | None = Field(default=None, max_length=40)
    website: str | None = Field(default=None, max_length=500)
    logo_url: str | None = Field(default=None, max_length=500)
    country: str = Field(min_length=2, max_length=100)

    @field_validator("name", "country")
    @classmethod
    def normalize_required_text(cls, value: str) -> str:
        normalized = " ".join(value.split())
        if len(normalized) < 2:
            raise ValueError("This value must contain at least two characters.")
        return normalized

    @field_validator("description")
    @classmethod
    def normalize_description(cls, value: str | None) -> str | None:
        return value.strip() or None if value is not None else None

    @field_validator("contact_email")
    @classmethod
    def validate_contact_email(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip().lower()
        if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", value):
            raise ValueError("Enter a valid contact email address.")
        return value

    @field_validator("website", "logo_url")
    @classmethod
    def validate_web_url(cls, value: str | None) -> str | None:
        if value is None or not value.strip():
            return None
        normalized = value.strip()
        parsed = urlparse(normalized)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise ValueError("Enter a valid http or https URL.")
        return normalized


class OrganizationRequestCreate(OrganizationDetailsInput):
    supporting_information: str | None = Field(default=None, max_length=4000)

    @field_validator("supporting_information")
    @classmethod
    def normalize_supporting_information(cls, value: str | None) -> str | None:
        return value.strip() or None if value is not None else None


class OrganizationRequestResponse(BaseModel):
    id: uuid.UUID
    name: str
    organization_type: OrganizationType
    description: str | None
    logo_url: str | None
    contact_email: str | None
    contact_phone: str | None = None
    website: str | None
    country: str
    supporting_information: str | None
    status: OrganizationRequestStatus
    rejection_reason: str | None
    requested_by: uuid.UUID | None
    reviewed_by: uuid.UUID | None
    reviewed_at: datetime | None
    organization_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @computed_field
    @property
    def requested_by_name(self) -> str | None:
        requester = getattr(self, "requester", None)
        return requester.full_name if requester is not None else None

    @computed_field
    @property
    def reviewed_by_name(self) -> str | None:
        reviewer = getattr(self, "reviewer", None)
        return reviewer.full_name if reviewer is not None else None


class OrganizationMembershipPolicy(BaseModel):
    membership_requires_approval: bool = True
    membership_requires_invitation: bool = False
    verification_mode: MembershipVerificationMode = MembershipVerificationMode.NONE
    verified_email_domains: list[str] = Field(default_factory=list)
    verification_instructions: str | None = None


class OrganizationProfileUpdate(OrganizationDetailsInput):
    is_public_profile: bool = True


class OrganizationMembershipPolicyUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    membership_requires_approval: bool
    membership_requires_invitation: bool
    verification_mode: MembershipVerificationMode
    verified_email_domains: list[str] = Field(default_factory=list, max_length=20)
    verification_instructions: str | None = Field(default=None, max_length=2000)

    @field_validator("verified_email_domains")
    @classmethod
    def normalize_email_domains(cls, values: list[str]) -> list[str]:
        normalized_domains: list[str] = []
        for value in values:
            domain = value.strip().lower().rstrip(".")
            if not domain or "@" in domain or not re.fullmatch(
                r"(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}",
                domain,
            ):
                raise ValueError("Enter email domains such as university.edu, without @.")
            if domain not in normalized_domains:
                normalized_domains.append(domain)
        return normalized_domains

    @field_validator("verification_instructions")
    @classmethod
    def normalize_verification_instructions(cls, value: str | None) -> str | None:
        return value.strip() or None if value is not None else None

    @model_validator(mode="after")
    def validate_verification_configuration(self) -> "OrganizationMembershipPolicyUpdate":
        if self.verification_mode == MembershipVerificationMode.INSTITUTIONAL_EMAIL:
            if not self.verified_email_domains:
                raise ValueError("Add at least one approved domain for institutional email verification.")
            if self.verification_instructions is not None:
                raise ValueError("Email-domain verification cannot include manual-review instructions.")
        elif self.verification_mode == MembershipVerificationMode.ADMIN_REVIEW:
            if self.verified_email_domains:
                raise ValueError("Email domains are only valid for institutional email verification.")
            if not self.verification_instructions:
                raise ValueError("Explain how administrators will verify membership.")
        elif self.verified_email_domains or self.verification_instructions is not None:
            raise ValueError("Verification details require a verification method.")
        return self


class OrganizationResponse(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    description: str | None
    organization_type: OrganizationType
    logo_url: str | None
    contact_email: str | None
    contact_phone: str | None = None
    website: str | None
    is_public_profile: bool = True
    country: str
    status: OrganizationStatus
    created_by: uuid.UUID
    approved_by: uuid.UUID | None
    approved_at: datetime | None
    created_at: datetime
    updated_at: datetime
    current_owner_id: uuid.UUID | None = None
    current_owner_name: str | None = None
    management_arrangement: str | None = None
    membership_policy: OrganizationMembershipPolicy = Field(
        default_factory=OrganizationMembershipPolicy
    )

    model_config = ConfigDict(from_attributes=True)

    @model_validator(mode="before")
    @classmethod
    def enrich_management(cls, value):
        if not hasattr(value, "management_assignments"):
            return value
        owner = next(
            (
                assignment
                for assignment in value.management_assignments
                if getattr(assignment.role, "value", assignment.role)
                == "ORGANISATION_OWNER"
            ),
            None,
        )
        data = {}
        for field_name in cls.model_fields:
            if field_name in {
                "current_owner_id",
                "current_owner_name",
                "management_arrangement",
            }:
                continue
            field_value = getattr(value, field_name, None)
            if hasattr(field_value, "value"):
                field_value = field_value.value
            data[field_name] = field_value
        if owner is not None:
            data["current_owner_id"] = owner.user_id
            data["current_owner_name"] = getattr(owner.user, "full_name", None)
            data["management_arrangement"] = "HAND_OVER"
        else:
            data["management_arrangement"] = "AWAITING_OWNER"
        data["membership_policy"] = {
            "membership_requires_approval": value.membership_requires_approval,
            "membership_requires_invitation": value.membership_requires_invitation,
            "verification_mode": value.membership_verification_mode,
            "verified_email_domains": value.membership_verified_email_domains,
            "verification_instructions": value.membership_verification_instructions,
        }
        return data


class OrganizationReject(BaseModel):
    model_config = ConfigDict(extra="forbid")

    reason: str = Field(min_length=2, max_length=2000)

    @field_validator("reason")
    @classmethod
    def normalize_reason(cls, value: str) -> str:
        normalized = " ".join(value.split())
        if len(normalized) < 2:
            raise ValueError("A rejection reason is required.")
        return normalized


class OrganizationDirectCreate(OrganizationDetailsInput):
    slug: str | None = Field(default=None, min_length=2, max_length=120)
    management_mode: OrganizationManagementMode
    manager_user_id: uuid.UUID | None = None

    @field_validator("slug")
    @classmethod
    def normalize_slug(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip().lower()
        if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", normalized):
            raise ValueError("Slug must contain lowercase letters, numbers, and hyphens.")
        return normalized

    @model_validator(mode="after")
    def validate_management_choice(self) -> "OrganizationDirectCreate":
        if self.management_mode == OrganizationManagementMode.ASSIGN_OWNER:
            if self.manager_user_id is None:
                raise ValueError("manager_user_id is required when assigning an owner.")
        elif self.manager_user_id is not None:
            raise ValueError(
                "manager_user_id must be omitted when retaining platform management."
            )
        return self


class OrganizationManagementUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    management_mode: OrganizationManagementMode
    manager_user_id: uuid.UUID | None = None

    @model_validator(mode="after")
    def validate_management_choice(self) -> "OrganizationManagementUpdate":
        if self.management_mode == OrganizationManagementMode.ASSIGN_OWNER:
            if self.manager_user_id is None:
                raise ValueError("manager_user_id is required when assigning an owner.")
        elif self.manager_user_id is not None:
            raise ValueError(
                "manager_user_id must be omitted when retaining platform management."
            )
        return self


class OrganizationStatusResponse(BaseModel):
    id: uuid.UUID
    status: OrganizationStatus


class OrganizationRequestRejectResponse(OrganizationRequestResponse):
    pass


class OrganizationManagementAssignmentResponse(BaseModel):
    organization_id: uuid.UUID
    user_id: uuid.UUID
    role: OrganizationManagementRole
    management_mode: OrganizationManagementMode


class OrganizationRequestList(BaseModel):
    items: list[OrganizationRequestResponse]


class OrganizationList(BaseModel):
    items: list[OrganizationResponse]


class MembershipRequestCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    message: str | None = Field(default=None, max_length=2000)
    verification_note: str | None = Field(default=None, max_length=2000)

    @field_validator("message")
    @classmethod
    def normalize_message(cls, value: str | None) -> str | None:
        return value.strip() or None if value is not None else None

    @field_validator("verification_note")
    @classmethod
    def normalize_verification_note(cls, value: str | None) -> str | None:
        return value.strip() or None if value is not None else None


class MembershipRequestReject(BaseModel):
    model_config = ConfigDict(extra="forbid")

    reason: str = Field(min_length=2, max_length=2000)

    @field_validator("reason")
    @classmethod
    def normalize_reason(cls, value: str) -> str:
        normalized = " ".join(value.split())
        if len(normalized) < 2:
            raise ValueError("A rejection reason is required.")
        return normalized


class MembershipRequestResponse(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    user_id: uuid.UUID
    status: MembershipRequestStatus
    message: str | None
    reviewed_by: uuid.UUID | None
    reviewed_at: datetime | None
    rejection_reason: str | None
    created_at: datetime
    updated_at: datetime
    applicant_name: str | None = None
    applicant_email: str | None = None
    notification_delivery: NotificationDeliveryStatus | None = None

    model_config = ConfigDict(from_attributes=True)


class MembershipRequestList(BaseModel):
    items: list[MembershipRequestResponse]


class MembershipResponse(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    user_id: uuid.UUID
    status: MembershipStatus
    joined_at: datetime
    reviewed_by: uuid.UUID | None
    reviewed_at: datetime | None
    role: str
    organization_name: str | None = None
    organization_type: OrganizationType | None = None

    model_config = ConfigDict(from_attributes=True)


class MembershipList(BaseModel):
    items: list[MembershipResponse]


class MembershipStatusResponse(BaseModel):
    organization_id: uuid.UUID
    membership_status: MembershipStatus | None
    membership_request_status: MembershipRequestStatus | None
    membership_verification_status: MembershipVerificationStatus | None = None
    can_manage: bool = False


class MembershipJoinResponse(BaseModel):
    status: str
    membership_id: uuid.UUID | None = None
    membership_request_id: uuid.UUID | None = None
    verification_id: uuid.UUID | None = None
    notification_delivery: NotificationDeliveryStatus | None = None


class MembershipVerificationCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    note: str | None = Field(default=None, max_length=2000)

    @field_validator("note")
    @classmethod
    def normalize_note(cls, value: str | None) -> str | None:
        return value.strip() or None if value is not None else None


class MembershipVerificationReject(BaseModel):
    model_config = ConfigDict(extra="forbid")

    reason: str = Field(min_length=2, max_length=2000)

    @field_validator("reason")
    @classmethod
    def normalize_reason(cls, value: str) -> str:
        normalized = " ".join(value.split())
        if len(normalized) < 2:
            raise ValueError("A rejection reason is required.")
        return normalized


class MembershipVerificationResponse(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    user_id: uuid.UUID
    membership_request_id: uuid.UUID | None
    invitation_id: uuid.UUID | None
    verification_mode: MembershipVerificationMode
    status: MembershipVerificationStatus
    membership_requires_approval: bool
    submission_note: str | None
    rejection_reason: str | None
    reviewed_by: uuid.UUID | None
    reviewed_at: datetime | None
    created_at: datetime
    applicant_name: str | None = None
    applicant_email: str | None = None
    notification_delivery: NotificationDeliveryStatus | None = None

    model_config = ConfigDict(from_attributes=True)


class MembershipVerificationList(BaseModel):
    items: list[MembershipVerificationResponse]


class OrganizationInvitationCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: str = Field(min_length=3, max_length=320)
    expires_in_days: int = Field(default=7, ge=1, le=30)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        normalized = value.strip().lower()
        if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", normalized):
            raise ValueError("Enter a valid email address.")
        return normalized


class OrganizationInvitationResponse(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    email: str
    status: OrganizationInvitationStatus
    expires_at: datetime
    invited_by: uuid.UUID | None
    accepted_by: uuid.UUID | None
    accepted_at: datetime | None
    revoked_at: datetime | None
    created_at: datetime
    invitation_url: str | None = None
    notification_delivery: NotificationDeliveryStatus | None = None

    model_config = ConfigDict(from_attributes=True)


class OrganizationInvitationList(BaseModel):
    items: list[OrganizationInvitationResponse]


class OrganizationInvitationAccept(BaseModel):
    model_config = ConfigDict(extra="forbid")

    token: str = Field(min_length=32, max_length=200)
    verification_note: str | None = Field(default=None, max_length=2000)

    @field_validator("verification_note")
    @classmethod
    def normalize_verification_note(cls, value: str | None) -> str | None:
        return value.strip() or None if value is not None else None
