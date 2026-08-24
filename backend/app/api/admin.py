from __future__ import annotations

import logging
import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import require_admin
from app.database.session import get_db
from app.models.user import User
from app.schemas.admin import (
    AdminApprovalsOverviewResponse,
    AdminUserListResponse,
    AdminUserResponse,
    AdminUserStatsResponse,
    AssignOfficialRequest,
    OfficialSummaryResponse,
    UserRoleUpdateRequest,
    UserStatusUpdateRequest,
)
from app.schemas.election import ElectionDetailResponse, ElectionRejectRequest
from app.services.admin import (
    assign_user_as_official,
    get_admin_approvals_overview,
    get_election_officials_summary,
    get_users_list,
    get_users_stats,
    update_user_role,
    update_user_status,
)
from app.services.elections import record_rejection, super_admin_final_approval
from app.api.elections import format_election_detail

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin", tags=["Super Admin"])


# ── User Management ───────────────────────────────────────────────────────────

@router.get("/users", response_model=AdminUserListResponse)
async def list_all_users(
    search: str | None = Query(None, description="Search by name, email, or student ID"),
    role: str | None = Query(None, description="Filter by role (ALL, STUDENT, ELECTION_OFFICIAL, SUPER_ADMIN)"),
    is_active: bool | None = Query(None, description="Filter by active status"),
    is_verified: bool | None = Query(None, description="Filter by student verification status"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> AdminUserListResponse:
    return await get_users_list(
        db=db,
        search=search,
        role=role,
        is_active=is_active,
        is_verified=is_verified,
        page=page,
        limit=limit,
    )


@router.get("/users/stats", response_model=AdminUserStatsResponse)
async def get_user_statistics(
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> AdminUserStatsResponse:
    return await get_users_stats(db)


@router.patch("/users/{user_id}/role", response_model=AdminUserResponse)
async def change_user_role(
    user_id: uuid.UUID,
    payload: UserRoleUpdateRequest,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> AdminUserResponse:
    user = await update_user_role(db, admin, user_id, payload.role)
    await db.commit()
    return user


@router.patch("/users/{user_id}/status", response_model=AdminUserResponse)
async def change_user_status(
    user_id: uuid.UUID,
    payload: UserStatusUpdateRequest,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> AdminUserResponse:
    user = await update_user_status(db, admin, user_id, payload.is_active)
    await db.commit()
    return user


# ── Election Officials Management ─────────────────────────────────────────────

@router.get("/officials", response_model=list[OfficialSummaryResponse])
async def list_election_officials(
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> list[OfficialSummaryResponse]:
    return await get_election_officials_summary(db)


@router.post("/officials/assign", response_model=AdminUserResponse)
async def assign_official_role(
    payload: AssignOfficialRequest,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> AdminUserResponse:
    user = await assign_user_as_official(db, admin, payload.user_id, payload.role)
    await db.commit()
    return user


# ── Approvals Pipeline ────────────────────────────────────────────────────────

@router.get("/approvals", response_model=AdminApprovalsOverviewResponse)
async def get_approvals_pipeline(
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> AdminApprovalsOverviewResponse:
    return await get_admin_approvals_overview(db)


@router.post("/approvals/{election_id}/final-approve", response_model=ElectionDetailResponse)
async def admin_final_approve_election(
    election_id: uuid.UUID,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> ElectionDetailResponse:
    election = await super_admin_final_approval(db, election_id, admin)
    return await format_election_detail(db, election)


@router.post("/approvals/{election_id}/reject", response_model=ElectionDetailResponse)
async def admin_reject_election(
    election_id: uuid.UUID,
    payload: ElectionRejectRequest,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> ElectionDetailResponse:
    election = await record_rejection(db, election_id, admin, payload.reason)
    return await format_election_detail(db, election)
