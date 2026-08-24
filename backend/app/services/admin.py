from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.election import Election, ElectionApproval, ElectionOfficialAssignment, ElectionPosition, ElectionStatus
from app.models.user import User, UserRole
from app.schemas.admin import (
    AdminApprovalsOverviewResponse,
    AdminUserListResponse,
    AdminUserResponse,
    AdminUserStatsResponse,
    ApprovalPipelineElectionResponse,
    ApprovalReviewerStatus,
    OfficialSummaryResponse,
)
from app.schemas.election import OfficialUserResponse
from app.services.elections import calculate_eligibility_estimate, record_audit_log

logger = logging.getLogger(__name__)


# ── Users Services ────────────────────────────────────────────────────────────

async def get_users_list(
    db: AsyncSession,
    search: str | None = None,
    role: str | None = None,
    is_active: bool | None = None,
    is_verified: bool | None = None,
    page: int = 1,
    limit: int = 20,
) -> AdminUserListResponse:
    stmt = select(User)

    if search:
        s = f"%{search.strip().lower()}%"
        stmt = stmt.where(
            or_(
                func.lower(User.full_name).like(s),
                func.lower(User.email).like(s),
                func.lower(User.student_id).like(s),
            )
        )

    if role and role.upper() != "ALL":
        try:
            role_enum = UserRole(role.upper())
            stmt = stmt.where(User.role == role_enum)
        except ValueError:
            pass

    if is_active is not None:
        stmt = stmt.where(User.is_active == is_active)

    if is_verified is not None:
        stmt = stmt.where(User.is_verified == is_verified)

    # Count total matching
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(count_stmt)).scalar_one()

    # Apply pagination & sorting
    offset = (page - 1) * limit
    stmt = stmt.order_by(User.created_at.desc()).offset(offset).limit(limit)

    users = (await db.execute(stmt)).scalars().all()
    total_pages = max(1, (total + limit - 1) // limit)

    return AdminUserListResponse(
        users=[AdminUserResponse.model_validate(u) for u in users],
        total=total,
        page=page,
        limit=limit,
        total_pages=total_pages,
    )


async def get_users_stats(db: AsyncSession) -> AdminUserStatsResponse:
    total_users = (await db.execute(select(func.count(User.id)))).scalar_one()
    total_students = (
        await db.execute(select(func.count(User.id)).where(User.role == UserRole.STUDENT))
    ).scalar_one()
    total_officials = (
        await db.execute(select(func.count(User.id)).where(User.role == UserRole.ELECTION_OFFICIAL))
    ).scalar_one()
    total_admins = (
        await db.execute(select(func.count(User.id)).where(User.role == UserRole.SUPER_ADMIN))
    ).scalar_one()
    total_active = (
        await db.execute(select(func.count(User.id)).where(User.is_active == True))  # noqa: E712
    ).scalar_one()
    total_inactive = total_users - total_active
    total_verified = (
        await db.execute(select(func.count(User.id)).where(User.is_verified == True))  # noqa: E712
    ).scalar_one()

    return AdminUserStatsResponse(
        total_users=total_users,
        total_students=total_students,
        total_officials=total_officials,
        total_admins=total_admins,
        total_active=total_active,
        total_inactive=total_inactive,
        total_verified=total_verified,
    )


async def update_user_role(
    db: AsyncSession,
    acting_admin: User,
    target_user_id: uuid.UUID,
    new_role: UserRole,
) -> AdminUserResponse:
    user = (await db.execute(select(User).where(User.id == target_user_id))).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    if user.id == acting_admin.id and new_role != UserRole.SUPER_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot demote your own Super Admin account.",
        )

    # Protect last remaining Super Admin
    if user.role == UserRole.SUPER_ADMIN and new_role != UserRole.SUPER_ADMIN:
        admin_count = (
            await db.execute(select(func.count(User.id)).where(User.role == UserRole.SUPER_ADMIN))
        ).scalar_one()
        if admin_count <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot demote the last remaining Super Admin in the system.",
            )

    old_role = user.role
    user.role = new_role
    await db.flush()
    await db.refresh(user)

    logger.info(
        "User role updated: user_id=%s, old_role=%s, new_role=%s by admin=%s",
        user.id, old_role, new_role, acting_admin.id
    )
    return AdminUserResponse.model_validate(user)


async def update_user_status(
    db: AsyncSession,
    acting_admin: User,
    target_user_id: uuid.UUID,
    is_active: bool,
) -> AdminUserResponse:
    user = (await db.execute(select(User).where(User.id == target_user_id))).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    if user.id == acting_admin.id and not is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot deactivate your own Super Admin account.",
        )

    user.is_active = is_active
    await db.flush()
    await db.refresh(user)
    return AdminUserResponse.model_validate(user)


# ── Election Officials Services ───────────────────────────────────────────────

async def get_election_officials_summary(db: AsyncSession) -> list[OfficialSummaryResponse]:
    # Query all users with ELECTION_OFFICIAL or SUPER_ADMIN roles
    officials = (
        await db.execute(
            select(User)
            .where(User.role.in_([UserRole.ELECTION_OFFICIAL, UserRole.SUPER_ADMIN]))
            .order_by(User.role.desc(), User.full_name)
        )
    ).scalars().all()

    results: list[OfficialSummaryResponse] = []
    for off in officials:
        # Get assignments
        assignments = (
            await db.execute(
                select(ElectionOfficialAssignment, Election)
                .join(Election, ElectionOfficialAssignment.election_id == Election.id)
                .where(ElectionOfficialAssignment.user_id == off.id)
                .order_by(Election.created_at.desc())
            )
        ).all()

        total_assigned = len(assignments)
        recent_election_names = [elec.name for _, elec in assignments[:3]]

        # Count approvals
        approvals = (
            await db.execute(
                select(ElectionApproval)
                .where(ElectionApproval.user_id == off.id)
            )
        ).scalars().all()

        pending_reviews = sum(1 for a in approvals if a.approval_status == "PENDING")
        approved_count = sum(1 for a in approvals if a.approval_status == "APPROVED")

        results.append(
            OfficialSummaryResponse(
                id=off.id,
                full_name=off.full_name,
                email=off.email,
                student_id=off.student_id,
                role=off.role,
                is_active=off.is_active,
                created_at=off.created_at,
                total_assigned_elections=total_assigned,
                pending_reviews_count=pending_reviews,
                approved_elections_count=approved_count,
                recent_assigned_election_names=recent_election_names,
            )
        )

    return results


async def assign_user_as_official(
    db: AsyncSession,
    acting_admin: User,
    target_user_id: uuid.UUID,
    role: UserRole = UserRole.ELECTION_OFFICIAL,
) -> AdminUserResponse:
    return await update_user_role(db, acting_admin, target_user_id, role)


# ── Approvals Pipeline Services ───────────────────────────────────────────────

async def get_admin_approvals_overview(db: AsyncSession) -> AdminApprovalsOverviewResponse:
    # Query elections in review, pending approval, scheduled, approved, and rejected
    stmt = (
        select(Election)
        .options(
            selectinload(Election.creator),
            selectinload(Election.positions),
            selectinload(Election.official_assignments).selectinload(ElectionOfficialAssignment.user),
            selectinload(Election.approvals).selectinload(ElectionApproval.user),
        )
        .order_by(Election.updated_at.desc())
    )
    all_elections = (await db.execute(stmt)).scalars().all()

    ready_list: list[ApprovalPipelineElectionResponse] = []
    review_list: list[ApprovalPipelineElectionResponse] = []
    approved_list: list[ApprovalPipelineElectionResponse] = []
    rejected_list: list[ApprovalPipelineElectionResponse] = []

    for election in all_elections:
        estimated_voters, _ = await calculate_eligibility_estimate(
            db, election.eligibility_criteria or {}
        )

        total_officials = len(election.official_assignments)
        approved_officials = sum(
            1 for apprv in election.approvals if apprv.approval_status == "APPROVED"
        )
        is_ready = (
            total_officials > 0
            and approved_officials == total_officials
            and election.status in (ElectionStatus.PENDING_APPROVAL, ElectionStatus.OFFICIAL_REVIEW)
        )

        # Build reviewer statuses
        reviewers: list[ApprovalReviewerStatus] = []
        for a in election.official_assignments:
            match_apprv = next((app for app in election.approvals if app.user_id == a.user_id), None)
            reviewers.append(
                ApprovalReviewerStatus(
                    official_id=a.user_id,
                    full_name=a.user.full_name if a.user else "Election Official",
                    email=a.user.email if a.user else "",
                    status=match_apprv.approval_status if match_apprv else "PENDING",
                    comment=match_apprv.comment if match_apprv else None,
                    reviewed_at=match_apprv.approved_at if match_apprv else None,
                )
            )

        # Extract rejection comment if rejected
        rejection_reason: str | None = None
        if election.status == ElectionStatus.REJECTED:
            rejected_apprv = next(
                (app for app in election.approvals if app.approval_status == "REJECTED"), None
            )
            rejection_reason = rejected_apprv.comment if rejected_apprv else "Returned by administrator."

        elec_resp = ApprovalPipelineElectionResponse(
            id=election.id,
            name=election.name,
            description=election.description,
            department=election.department,
            election_type=election.election_type,
            start_at=election.start_at,
            end_at=election.end_at,
            status=election.status,
            result_visibility=election.result_visibility,
            created_at=election.created_at,
            creator=OfficialUserResponse.model_validate(election.creator) if election.creator else None,
            positions_count=len(election.positions),
            estimated_voters=estimated_voters,
            total_assigned_officials=total_officials,
            approved_officials_count=approved_officials,
            is_ready_for_final_approval=is_ready,
            reviewers=reviewers,
            rejection_reason=rejection_reason,
        )

        if election.status in (ElectionStatus.APPROVED, ElectionStatus.SCHEDULED):
            approved_list.append(elec_resp)
        elif election.status == ElectionStatus.REJECTED:
            rejected_list.append(elec_resp)
        elif is_ready:
            ready_list.append(elec_resp)
        elif election.status in (ElectionStatus.PENDING_APPROVAL, ElectionStatus.OFFICIAL_REVIEW):
            review_list.append(elec_resp)

    counts = {
        "ready": len(ready_list),
        "in_review": len(review_list),
        "approved": len(approved_list),
        "rejected": len(rejected_list),
        "total_active": len(ready_list) + len(review_list),
    }

    return AdminApprovalsOverviewResponse(
        ready_for_final_approval=ready_list,
        under_official_review=review_list,
        recently_approved=approved_list,
        rejected=rejected_list,
        counts=counts,
    )
