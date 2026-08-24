from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.models.user import UserRole
from app.models.election import ElectionStatus, ResultVisibility
from app.schemas.election import OfficialUserResponse, PositionResponse


# ── Users Schemas ─────────────────────────────────────────────────────────────

class AdminUserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    firebase_uid: str
    student_id: str | None = None
    full_name: str
    email: str
    role: UserRole
    is_active: bool
    is_verified: bool
    verified_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class AdminUserListResponse(BaseModel):
    users: list[AdminUserResponse]
    total: int
    page: int
    limit: int
    total_pages: int


class AdminUserStatsResponse(BaseModel):
    total_users: int
    total_students: int
    total_officials: int
    total_admins: int
    total_active: int
    total_inactive: int
    total_verified: int


class UserRoleUpdateRequest(BaseModel):
    role: UserRole


class UserStatusUpdateRequest(BaseModel):
    is_active: bool


# ── Election Officials Schemas ───────────────────────────────────────────────

class OfficialSummaryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    full_name: str
    email: str
    student_id: str | None = None
    role: UserRole
    is_active: bool
    created_at: datetime
    total_assigned_elections: int
    pending_reviews_count: int
    approved_elections_count: int
    recent_assigned_election_names: list[str] = Field(default_factory=list)


class AssignOfficialRequest(BaseModel):
    user_id: uuid.UUID
    role: UserRole = UserRole.ELECTION_OFFICIAL


# ── Approvals Pipeline Schemas ───────────────────────────────────────────────

class ApprovalReviewerStatus(BaseModel):
    official_id: uuid.UUID
    full_name: str
    email: str
    status: str  # PENDING, APPROVED, REJECTED
    comment: str | None = None
    reviewed_at: datetime | None = None


class ApprovalPipelineElectionResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None = None
    department: str
    election_type: str
    start_at: datetime | None = None
    end_at: datetime | None = None
    status: ElectionStatus
    result_visibility: ResultVisibility
    created_at: datetime
    creator: OfficialUserResponse | None = None
    positions_count: int
    estimated_voters: int
    total_assigned_officials: int
    approved_officials_count: int
    is_ready_for_final_approval: bool
    reviewers: list[ApprovalReviewerStatus] = Field(default_factory=list)
    rejection_reason: str | None = None


class AdminApprovalsOverviewResponse(BaseModel):
    ready_for_final_approval: list[ApprovalPipelineElectionResponse]
    under_official_review: list[ApprovalPipelineElectionResponse]
    recently_approved: list[ApprovalPipelineElectionResponse]
    rejected: list[ApprovalPipelineElectionResponse]
    counts: dict[str, int]
