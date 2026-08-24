from __future__ import annotations

import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, require_admin, require_election_official
from app.database.session import get_db
from app.models.election import Election
from app.models.user import User
from app.schemas.election import (
    ElectionApprovalRequest,
    ElectionCreateRequest,
    ElectionDetailResponse,
    ElectionListItemResponse,
    ElectionRejectRequest,
    ElectionUpdateRequest,
    EligibilityEstimateRequest,
    EligibilityEstimateResponse,
    OfficialUserResponse,
)
from app.services.elections import (
    calculate_eligibility_estimate,
    create_election,
    ensure_can_access_election,
    get_election_by_id,
    get_eligible_official_users,
    list_user_elections,
    record_official_approval,
    record_rejection,
    submit_election_for_approval,
    super_admin_final_approval,
    update_election,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/elections", tags=["Elections"])


async def format_election_detail(
    db: AsyncSession,
    election: Election,
) -> ElectionDetailResponse:
    estimated_voters, _ = await calculate_eligibility_estimate(
        db, election.eligibility_criteria or {}
    )

    creator_resp = (
        OfficialUserResponse.model_validate(election.creator)
        if election.creator
        else None
    )

    positions_sorted = sorted(election.positions, key=lambda p: p.display_order)

    # Format audit logs with user names if available
    formatted_audit_logs = []
    for log in election.audit_logs:
        log_dict = {
            "id": log.id,
            "election_id": log.election_id,
            "user_id": log.user_id,
            "user_name": log.user.full_name if log.user else None,
            "action": log.action,
            "details": log.details,
            "created_at": log.created_at,
        }
        formatted_audit_logs.append(log_dict)

    # Format official assignments
    formatted_assignments = []
    for a in election.official_assignments:
        formatted_assignments.append({
            "id": a.id,
            "election_id": a.election_id,
            "user_id": a.user_id,
            "assigned_at": a.assigned_at,
            "user": OfficialUserResponse.model_validate(a.user) if a.user else None,
        })

    # Format approvals
    formatted_approvals = []
    for apprv in election.approvals:
        formatted_approvals.append({
            "id": apprv.id,
            "election_id": apprv.election_id,
            "user_id": apprv.user_id,
            "approval_status": apprv.approval_status,
            "comment": apprv.comment,
            "approved_at": apprv.approved_at,
            "created_at": apprv.created_at,
            "user": OfficialUserResponse.model_validate(apprv.user) if apprv.user else None,
        })

    return ElectionDetailResponse(
        id=election.id,
        name=election.name,
        description=election.description,
        department=election.department,
        election_type=election.election_type,
        start_at=election.start_at,
        end_at=election.end_at,
        status=election.status,
        result_visibility=election.result_visibility,
        eligibility_criteria=election.eligibility_criteria or {},
        created_by=election.created_by,
        creator=creator_resp,
        created_at=election.created_at,
        updated_at=election.updated_at,
        positions=positions_sorted,
        official_assignments=formatted_assignments,
        approvals=formatted_approvals,
        audit_logs=formatted_audit_logs,
        estimated_voters=estimated_voters,
    )


@router.get("", response_model=list[ElectionListItemResponse])
async def list_elections(
    current_user: User = Depends(require_election_official),
    db: AsyncSession = Depends(get_db),
) -> list[ElectionListItemResponse]:
    elections = await list_user_elections(db, current_user)
    items = []
    for e in elections:
        items.append(
            ElectionListItemResponse(
                id=e.id,
                name=e.name,
                description=e.description,
                department=e.department,
                election_type=e.election_type,
                start_at=e.start_at,
                end_at=e.end_at,
                status=e.status,
                result_visibility=e.result_visibility,
                created_by=e.created_by,
                creator_name=e.creator.full_name if e.creator else None,
                positions_count=len(e.positions),
                officials_count=len(e.official_assignments),
                created_at=e.created_at,
                updated_at=e.updated_at,
            )
        )
    return items


@router.get("/officials", response_model=list[OfficialUserResponse])
async def list_officials(
    _: User = Depends(require_election_official),
    db: AsyncSession = Depends(get_db),
) -> list[OfficialUserResponse]:
    users = await get_eligible_official_users(db)
    return [OfficialUserResponse.model_validate(u) for u in users]


@router.post("/eligibility-estimate", response_model=EligibilityEstimateResponse)
async def get_eligibility_estimate(
    payload: EligibilityEstimateRequest,
    _: User = Depends(require_election_official),
    db: AsyncSession = Depends(get_db),
) -> EligibilityEstimateResponse:
    count, summary = await calculate_eligibility_estimate(db, payload.eligibility_criteria)
    return EligibilityEstimateResponse(
        estimated_voters=count,
        criteria_summary=summary,
    )


@router.post("", response_model=ElectionDetailResponse, status_code=status.HTTP_201_CREATED)
async def create_new_election(
    payload: ElectionCreateRequest,
    current_user: User = Depends(require_election_official),
    db: AsyncSession = Depends(get_db),
) -> ElectionDetailResponse:
    election = await create_election(db, current_user, payload)
    return await format_election_detail(db, election)


@router.get("/{election_id}", response_model=ElectionDetailResponse)
async def get_election(
    election_id: uuid.UUID,
    current_user: User = Depends(require_election_official),
    db: AsyncSession = Depends(get_db),
) -> ElectionDetailResponse:
    election = await get_election_by_id(db, election_id)
    if not election:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Election not found.",
        )
    await ensure_can_access_election(db, current_user, election)
    return await format_election_detail(db, election)


@router.put("/{election_id}", response_model=ElectionDetailResponse)
async def update_existing_election(
    election_id: uuid.UUID,
    payload: ElectionUpdateRequest,
    current_user: User = Depends(require_election_official),
    db: AsyncSession = Depends(get_db),
) -> ElectionDetailResponse:
    election = await update_election(db, election_id, current_user, payload)
    return await format_election_detail(db, election)


@router.post("/{election_id}/submit", response_model=ElectionDetailResponse)
async def submit_election(
    election_id: uuid.UUID,
    current_user: User = Depends(require_election_official),
    db: AsyncSession = Depends(get_db),
) -> ElectionDetailResponse:
    election = await submit_election_for_approval(db, election_id, current_user)
    return await format_election_detail(db, election)


@router.post("/{election_id}/approve", response_model=ElectionDetailResponse)
async def approve_election(
    election_id: uuid.UUID,
    payload: ElectionApprovalRequest | None = None,
    current_user: User = Depends(require_election_official),
    db: AsyncSession = Depends(get_db),
) -> ElectionDetailResponse:
    comment = payload.comment if payload else None
    election = await record_official_approval(db, election_id, current_user, comment)
    return await format_election_detail(db, election)


@router.post("/{election_id}/reject", response_model=ElectionDetailResponse)
async def reject_election(
    election_id: uuid.UUID,
    payload: ElectionRejectRequest,
    current_user: User = Depends(require_election_official),
    db: AsyncSession = Depends(get_db),
) -> ElectionDetailResponse:
    election = await record_rejection(db, election_id, current_user, payload.reason)
    return await format_election_detail(db, election)


@router.post("/{election_id}/final-approve", response_model=ElectionDetailResponse)
async def final_approve_election(
    election_id: uuid.UUID,
    admin_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> ElectionDetailResponse:
    election = await super_admin_final_approval(db, election_id, admin_user)
    return await format_election_detail(db, election)
