import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.auth.permissions import AssignmentStatus, OrganizationRole, PlatformRole


class PlatformUserSummary(BaseModel):
    id: uuid.UUID
    full_name: str
    email: str
    is_active: bool
    is_platform_super_admin: bool
    created_at: datetime


class PlatformUserList(BaseModel):
    items: list[PlatformUserSummary]


class RoleAssignmentResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    role: str
    status: AssignmentStatus
    assigned_by: uuid.UUID | None
    assigned_at: datetime
    revoked_at: datetime | None
    organization_id: uuid.UUID | None = None


class OrganizationRoleAssignmentCreate(BaseModel):
    user_id: uuid.UUID
    role: OrganizationRole


class PlatformOverviewResponse(BaseModel):
    total_users: int
    total_organizations: int
    active_organizations: int
    pending_requests: int
    suspended_organizations: int


class AuditLogResponse(BaseModel):
    id: uuid.UUID
    actor_user_id: uuid.UUID | None
    action: str
    organization_id: uuid.UUID | None
    request_id: uuid.UUID | None
    details: dict
    created_at: datetime


class AuditLogList(BaseModel):
    items: list[AuditLogResponse]


class PlatformSettingResponse(BaseModel):
    key: str
    value: str
    description: str | None
    updated_at: datetime


class PlatformSettingUpdate(BaseModel):
    value: str = Field(min_length=1, max_length=4000)
    description: str | None = Field(default=None, max_length=255)


class PlatformSettingList(BaseModel):
    items: list[PlatformSettingResponse]
