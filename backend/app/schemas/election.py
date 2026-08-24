from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.models.election import ElectionStatus, ResultVisibility
from app.models.user import UserRole


# ── Eligibility Schemas ───────────────────────────────────────────────────────

class EligibilityCriteriaSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    departments: list[str] = Field(default_factory=lambda: ["Computer Science and Engineering"])
    levels: list[str] = Field(default_factory=list)
    classes: list[str] = Field(default_factory=list)
    statuses: list[str] = Field(default_factory=lambda: ["ACTIVE"])


class EligibilityEstimateRequest(BaseModel):
    eligibility_criteria: EligibilityCriteriaSchema = Field(default_factory=EligibilityCriteriaSchema)


class EligibilityEstimateResponse(BaseModel):
    estimated_voters: int
    criteria_summary: dict[str, Any]


# ── Position Schemas ──────────────────────────────────────────────────────────

class PositionCreateRequest(BaseModel):
    id: uuid.UUID | None = None
    name: str = Field(..., min_length=1, max_length=150)
    description: str | None = None
    display_order: int = 0
    number_of_winners: int = Field(default=1, ge=1)


class PositionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    election_id: uuid.UUID
    name: str
    description: str | None = None
    display_order: int
    number_of_winners: int
    created_at: datetime


class PositionReorderItem(BaseModel):
    position_id: uuid.UUID
    display_order: int


# ── Official User & Assignment Schemas ────────────────────────────────────────

class OfficialUserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    full_name: str
    email: str
    role: UserRole
    is_active: bool


class OfficialAssignmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    election_id: uuid.UUID
    user_id: uuid.UUID
    assigned_at: datetime
    user: OfficialUserResponse | None = None


# ── Approval Schemas ──────────────────────────────────────────────────────────

class ElectionApprovalRequest(BaseModel):
    comment: str | None = None
    target_user_id: uuid.UUID | None = None


class ElectionRejectRequest(BaseModel):
    reason: str = Field(..., min_length=1, description="Mandatory reason for rejection")


class ApprovalResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    election_id: uuid.UUID
    user_id: uuid.UUID
    approval_status: str
    comment: str | None = None
    approved_at: datetime | None = None
    created_at: datetime
    user: OfficialUserResponse | None = None


# ── Audit Log Schemas ─────────────────────────────────────────────────────────

class AuditLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    election_id: uuid.UUID
    user_id: uuid.UUID | None = None
    user_name: str | None = None
    action: str
    details: dict[str, Any] | None = None
    created_at: datetime


# ── Election Creation & Update Schemas ────────────────────────────────────────

class ElectionCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    department: str = Field(default="Computer Science and Engineering", min_length=1, max_length=150)
    election_type: str = Field(default="Departmental Election", min_length=1, max_length=100)
    start_at: datetime | None = None
    end_at: datetime | None = None
    result_visibility: ResultVisibility = ResultVisibility.OFFICIALS_DURING_VOTING
    eligibility_criteria: EligibilityCriteriaSchema | None = None
    positions: list[PositionCreateRequest] = Field(default_factory=list)
    official_user_ids: list[uuid.UUID] = Field(default_factory=list)


class ElectionUpdateRequest(BaseModel):
    name: str | None = Field(default=None, max_length=255)
    description: str | None = None
    department: str | None = Field(default=None, max_length=150)
    election_type: str | None = Field(default=None, max_length=100)
    start_at: datetime | None = None
    end_at: datetime | None = None
    result_visibility: ResultVisibility | None = None
    eligibility_criteria: EligibilityCriteriaSchema | None = None
    positions: list[PositionCreateRequest] | None = None
    official_user_ids: list[uuid.UUID] | None = None


# ── Election Response Schemas ─────────────────────────────────────────────────

class ElectionListItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    description: str | None = None
    department: str
    election_type: str
    start_at: datetime | None = None
    end_at: datetime | None = None
    status: ElectionStatus
    result_visibility: ResultVisibility
    created_by: uuid.UUID
    creator_name: str | None = None
    positions_count: int = 0
    officials_count: int = 0
    created_at: datetime
    updated_at: datetime


class ElectionDetailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    description: str | None = None
    department: str
    election_type: str
    start_at: datetime | None = None
    end_at: datetime | None = None
    status: ElectionStatus
    result_visibility: ResultVisibility
    eligibility_criteria: dict[str, Any]
    created_by: uuid.UUID
    creator: OfficialUserResponse | None = None
    created_at: datetime
    updated_at: datetime

    positions: list[PositionResponse] = Field(default_factory=list)
    official_assignments: list[OfficialAssignmentResponse] = Field(default_factory=list)
    approvals: list[ApprovalResponse] = Field(default_factory=list)
    audit_logs: list[AuditLogResponse] = Field(default_factory=list)
    estimated_voters: int = 0
