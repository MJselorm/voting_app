from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.election import (
    Election,
    ElectionApproval,
    ElectionAuditLog,
    ElectionOfficialAssignment,
    ElectionPosition,
    ElectionStatus,
    ResultVisibility,
)
from app.models.student import Student
from app.models.user import User, UserRole
from app.schemas.election import (
    ElectionCreateRequest,
    ElectionUpdateRequest,
    EligibilityCriteriaSchema,
    PositionCreateRequest,
)

logger = logging.getLogger(__name__)


# ── Authorization & Access Helpers ───────────────────────────────────────────

def ensure_can_create_election(user: User) -> None:
    if user.role not in (UserRole.SUPER_ADMIN, UserRole.ELECTION_OFFICIAL):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Election Officials and Super Admins can create elections.",
        )


async def ensure_can_access_election(db: AsyncSession, user: User, election: Election) -> None:
    if user.role == UserRole.SUPER_ADMIN:
        return
    if user.role == UserRole.ELECTION_OFFICIAL:
        if election.created_by == user.id:
            return
        assignment = (
            await db.execute(
                select(ElectionOfficialAssignment).where(
                    ElectionOfficialAssignment.election_id == election.id,
                    ElectionOfficialAssignment.user_id == user.id,
                )
            )
        ).scalar_one_or_none()
        if assignment is not None:
            return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="You do not have permission to access or manage this election.",
    )


# ── Audit Logging ─────────────────────────────────────────────────────────────

async def record_audit_log(
    db: AsyncSession,
    election_id: uuid.UUID,
    user_id: uuid.UUID | None,
    action: str,
    details: dict[str, Any] | None = None,
) -> ElectionAuditLog:
    audit_entry = ElectionAuditLog(
        id=uuid.uuid4(),
        election_id=election_id,
        user_id=user_id,
        action=action,
        details=details or {},
    )
    db.add(audit_entry)
    await db.flush()
    return audit_entry


# ── Eligibility Estimation ───────────────────────────────────────────────────

async def calculate_eligibility_estimate(
    db: AsyncSession,
    criteria: EligibilityCriteriaSchema | dict[str, Any],
) -> tuple[int, dict[str, Any]]:
    if isinstance(criteria, EligibilityCriteriaSchema):
        criteria_dict = criteria.model_dump()
    else:
        criteria_dict = criteria or {}

    departments = criteria_dict.get("departments") or ["Computer Science and Engineering"]
    levels = criteria_dict.get("levels") or []
    classes = criteria_dict.get("classes") or []
    statuses = criteria_dict.get("statuses") or ["ACTIVE"]

    query = select(func.count(Student.id))

    if departments:
        query = query.where(Student.department.in_(departments))
    if levels:
        query = query.where(Student.level.in_(levels))
    if classes:
        query = query.where(Student.class_.in_(classes))
    if statuses:
        upper_statuses = [s.upper() for s in statuses]
        query = query.where(func.upper(Student.status).in_(upper_statuses))

    count = (await db.execute(query)).scalar_one() or 0

    summary = {
        "departments": departments,
        "levels": levels,
        "classes": classes,
        "statuses": statuses,
    }
    return count, summary


# ── Election Queries & Loading ───────────────────────────────────────────────

async def get_election_by_id(
    db: AsyncSession,
    election_id: uuid.UUID,
) -> Election | None:
    stmt = (
        select(Election)
        .where(Election.id == election_id)
        .execution_options(populate_existing=True)
        .options(
            selectinload(Election.creator),
            selectinload(Election.positions),
            selectinload(Election.official_assignments).selectinload(ElectionOfficialAssignment.user),
            selectinload(Election.approvals).selectinload(ElectionApproval.user),
            selectinload(Election.audit_logs).selectinload(ElectionAuditLog.user),
        )
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def list_user_elections(
    db: AsyncSession,
    user: User,
) -> list[Election]:
    if user.role == UserRole.SUPER_ADMIN:
        stmt = (
            select(Election)
            .options(
                selectinload(Election.creator),
                selectinload(Election.positions),
                selectinload(Election.official_assignments),
            )
            .order_by(Election.created_at.desc())
        )
    elif user.role == UserRole.ELECTION_OFFICIAL:
        # Created by user OR assigned to user
        stmt = (
            select(Election)
            .outerjoin(ElectionOfficialAssignment, Election.id == ElectionOfficialAssignment.election_id)
            .where(
                or_(
                    Election.created_by == user.id,
                    ElectionOfficialAssignment.user_id == user.id,
                )
            )
            .options(
                selectinload(Election.creator),
                selectinload(Election.positions),
                selectinload(Election.official_assignments),
            )
            .distinct()
            .order_by(Election.created_at.desc())
        )
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Students cannot access the election management dashboard.",
        )

    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_eligible_official_users(db: AsyncSession) -> list[User]:
    stmt = (
        select(User)
        .where(
            User.role.in_([UserRole.ELECTION_OFFICIAL, UserRole.SUPER_ADMIN]),
            User.is_active == True,
        )
        .order_by(User.full_name)
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


# ── Create & Update Operations ───────────────────────────────────────────────

async def create_election(
    db: AsyncSession,
    user: User,
    payload: ElectionCreateRequest,
) -> Election:
    ensure_can_create_election(user)

    name = payload.name.strip()
    if not name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Election name is required.",
        )

    if payload.start_at and payload.end_at and payload.end_at <= payload.start_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Election end time must be after start time.",
        )

    criteria_dict = (
        payload.eligibility_criteria.model_dump()
        if payload.eligibility_criteria
        else {
            "departments": [payload.department],
            "levels": [],
            "classes": [],
            "statuses": ["ACTIVE"],
        }
    )

    election = Election(
        id=uuid.uuid4(),
        name=name,
        description=payload.description.strip() if payload.description else None,
        department=payload.department.strip() or "Computer Science and Engineering",
        election_type=payload.election_type.strip() or "Departmental Election",
        start_at=payload.start_at,
        end_at=payload.end_at,
        status=ElectionStatus.DRAFT,
        result_visibility=payload.result_visibility,
        eligibility_criteria=criteria_dict,
        created_by=user.id,
    )
    db.add(election)
    await db.flush()

    # Add positions if provided
    if payload.positions:
        for idx, pos_req in enumerate(payload.positions):
            pos_name = pos_req.name.strip()
            if pos_name:
                pos = ElectionPosition(
                    id=uuid.uuid4(),
                    election_id=election.id,
                    name=pos_name,
                    description=pos_req.description.strip() if pos_req.description else None,
                    display_order=pos_req.display_order if pos_req.display_order > 0 else (idx + 1),
                    number_of_winners=max(1, pos_req.number_of_winners),
                )
                db.add(pos)

    # Assign officials if provided
    if payload.official_user_ids:
        # Validate that users exist and are officials/admins
        valid_users = (
            await db.execute(
                select(User).where(
                    User.id.in_(payload.official_user_ids),
                    User.role.in_([UserRole.ELECTION_OFFICIAL, UserRole.SUPER_ADMIN]),
                    User.is_active == True,
                )
            )
        ).scalars().all()
        for u in valid_users:
            assignment = ElectionOfficialAssignment(
                id=uuid.uuid4(),
                election_id=election.id,
                user_id=u.id,
            )
            db.add(assignment)

    await record_audit_log(
        db,
        election_id=election.id,
        user_id=user.id,
        action="ELECTION_CREATED",
        details={
            "name": election.name,
            "department": election.department,
            "election_type": election.election_type,
            "status": election.status.value,
        },
    )

    await db.commit()
    updated = await get_election_by_id(db, election.id)
    if updated is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Election not found.")
    return updated


async def update_election(
    db: AsyncSession,
    election_id: uuid.UUID,
    user: User,
    payload: ElectionUpdateRequest,
) -> Election:
    election = await get_election_by_id(db, election_id)
    if not election:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Election not found.",
        )

    await ensure_can_access_election(db, user, election)

    # Only DRAFT or REJECTED elections can be edited
    if election.status not in (ElectionStatus.DRAFT, ElectionStatus.PENDING_APPROVAL):
        if election.status != ElectionStatus.DRAFT:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot edit election in {election.status.value} status.",
            )

    if payload.name is not None:
        trimmed = payload.name.strip()
        if not trimmed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Election name cannot be empty.",
            )
        election.name = trimmed

    if payload.description is not None:
        election.description = payload.description.strip() or None

    if payload.department is not None:
        election.department = payload.department.strip() or election.department

    if payload.election_type is not None:
        election.election_type = payload.election_type.strip() or election.election_type

    start_at = payload.start_at if payload.start_at is not None else election.start_at
    end_at = payload.end_at if payload.end_at is not None else election.end_at
    if start_at and end_at and end_at <= start_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Election end time must be after start time.",
        )

    if payload.start_at is not None:
        election.start_at = payload.start_at
    if payload.end_at is not None:
        election.end_at = payload.end_at

    if payload.result_visibility is not None:
        election.result_visibility = payload.result_visibility

    if payload.eligibility_criteria is not None:
        election.eligibility_criteria = payload.eligibility_criteria.model_dump()

    # Sync positions if provided
    if payload.positions is not None:
        # Delete existing positions and insert new list with correct display orders
        existing_positions = (
            await db.execute(
                select(ElectionPosition).where(ElectionPosition.election_id == election.id)
            )
        ).scalars().all()
        for p in existing_positions:
            await db.delete(p)
        await db.flush()

        for idx, pos_req in enumerate(payload.positions):
            pos_name = pos_req.name.strip()
            if pos_name:
                pos = ElectionPosition(
                    id=uuid.uuid4(),
                    election_id=election.id,
                    name=pos_name,
                    description=pos_req.description.strip() if pos_req.description else None,
                    display_order=pos_req.display_order if pos_req.display_order > 0 else (idx + 1),
                    number_of_winners=max(1, pos_req.number_of_winners),
                )
                db.add(pos)

    # Sync official assignments if provided
    if payload.official_user_ids is not None:
        existing_assignments = (
            await db.execute(
                select(ElectionOfficialAssignment).where(
                    ElectionOfficialAssignment.election_id == election.id
                )
            )
        ).scalars().all()
        for ea in existing_assignments:
            await db.delete(ea)
        await db.flush()

        if payload.official_user_ids:
            valid_users = (
                await db.execute(
                    select(User).where(
                        User.id.in_(payload.official_user_ids),
                        User.role.in_([UserRole.ELECTION_OFFICIAL, UserRole.SUPER_ADMIN]),
                        User.is_active == True,
                    )
                )
            ).scalars().all()
            for u in valid_users:
                assignment = ElectionOfficialAssignment(
                    id=uuid.uuid4(),
                    election_id=election.id,
                    user_id=u.id,
                )
                db.add(assignment)

    await record_audit_log(
        db,
        election_id=election.id,
        user_id=user.id,
        action="ELECTION_EDITED",
        details={"updated_fields": [k for k, v in payload.model_dump(exclude_unset=True).items()]},
    )

    await db.commit()
    updated = await get_election_by_id(db, election.id)
    if updated is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Election not found.")
    return updated


# ── Submission & Approval Workflow ───────────────────────────────────────────

def validate_for_submission(election: Election) -> None:
    errors = []
    if not election.name or not election.name.strip():
        errors.append("Election name is required.")
    if not election.department or not election.department.strip():
        errors.append("Department is required.")
    if not election.election_type or not election.election_type.strip():
        errors.append("Election type is required.")
    if not election.start_at:
        errors.append("Election start date and time are required.")
    if not election.end_at:
        errors.append("Election end date and time are required.")
    if election.start_at and election.end_at and election.end_at <= election.start_at:
        errors.append("Election end time must be after start time.")
    if not election.positions:
        errors.append("At least one position must be configured before submitting.")
    if not election.official_assignments:
        errors.append("At least one Election Official must be assigned before submitting.")

    if errors:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"message": "Election configuration is incomplete for submission.", "errors": errors},
        )


async def submit_election_for_approval(
    db: AsyncSession,
    election_id: uuid.UUID,
    user: User,
) -> Election:
    election = await get_election_by_id(db, election_id)
    if not election:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Election not found.",
        )

    await ensure_can_access_election(db, user, election)

    if election.status != ElectionStatus.DRAFT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot submit election in '{election.status.value}' status. Only DRAFT elections can be submitted.",
        )

    validate_for_submission(election)

    # Transition to PENDING_APPROVAL
    election.status = ElectionStatus.PENDING_APPROVAL

    # Reset or initialize ElectionApproval records for all assigned officials to PENDING
    existing_approvals = (
        await db.execute(
            select(ElectionApproval).where(ElectionApproval.election_id == election.id)
        )
    ).scalars().all()
    for apprv in existing_approvals:
        await db.delete(apprv)
    await db.flush()

    for assignment in election.official_assignments:
        approval_record = ElectionApproval(
            id=uuid.uuid4(),
            election_id=election.id,
            user_id=assignment.user_id,
            approval_status="PENDING",
            comment=None,
            approved_at=None,
        )
        db.add(approval_record)

    await record_audit_log(
        db,
        election_id=election.id,
        user_id=user.id,
        action="ELECTION_SUBMITTED",
        details={"status": ElectionStatus.PENDING_APPROVAL.value},
    )

    await db.commit()
    updated = await get_election_by_id(db, election.id)
    if updated is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Election not found.")
    return updated


async def record_official_approval(
    db: AsyncSession,
    election_id: uuid.UUID,
    user: User,
    comment: str | None = None,
) -> Election:
    election = await get_election_by_id(db, election_id)
    if not election:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Election not found.",
        )

    if election.status not in (ElectionStatus.PENDING_APPROVAL, ElectionStatus.OFFICIAL_REVIEW):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot approve election in '{election.status.value}' status.",
        )

    # User must be an assigned official or Super Admin
    is_assigned = any(a.user_id == user.id for a in election.official_assignments)
    if not is_assigned and user.role != UserRole.SUPER_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not assigned as an official for this election.",
        )

    approval_record = (
        await db.execute(
            select(ElectionApproval).where(
                ElectionApproval.election_id == election.id,
                ElectionApproval.user_id == user.id,
            )
        )
    ).scalar_one_or_none()

    if approval_record is None:
        approval_record = ElectionApproval(
            id=uuid.uuid4(),
            election_id=election.id,
            user_id=user.id,
            approval_status="APPROVED",
            comment=comment.strip() if comment else None,
            approved_at=datetime.now(timezone.utc),
        )
        db.add(approval_record)
    else:
        approval_record.approval_status = "APPROVED"
        approval_record.comment = comment.strip() if comment else None
        approval_record.approved_at = datetime.now(timezone.utc)

    await record_audit_log(
        db,
        election_id=election.id,
        user_id=user.id,
        action="ELECTION_APPROVED",
        details={"official_id": str(user.id), "comment": comment},
    )

    await db.commit()
    updated = await get_election_by_id(db, election.id)
    if updated is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Election not found.")
    return updated


async def record_rejection(
    db: AsyncSession,
    election_id: uuid.UUID,
    user: User,
    reason: str,
) -> Election:
    if not reason or not reason.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A rejection reason is required.",
        )

    election = await get_election_by_id(db, election_id)
    if not election:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Election not found.",
        )

    if election.status not in (
        ElectionStatus.PENDING_APPROVAL,
        ElectionStatus.OFFICIAL_REVIEW,
        ElectionStatus.SUPER_ADMIN_FINAL_APPROVAL,
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot reject election in '{election.status.value}' status.",
        )

    is_assigned = any(a.user_id == user.id for a in election.official_assignments)
    if not is_assigned and user.role != UserRole.SUPER_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to reject this election.",
        )

    approval_record = (
        await db.execute(
            select(ElectionApproval).where(
                ElectionApproval.election_id == election.id,
                ElectionApproval.user_id == user.id,
            )
        )
    ).scalar_one_or_none()

    if approval_record is None:
        approval_record = ElectionApproval(
            id=uuid.uuid4(),
            election_id=election.id,
            user_id=user.id,
            approval_status="REJECTED",
            comment=reason.strip(),
            approved_at=datetime.now(timezone.utc),
        )
        db.add(approval_record)
    else:
        approval_record.approval_status = "REJECTED"
        approval_record.comment = reason.strip()
        approval_record.approved_at = datetime.now(timezone.utc)

    # Return election to DRAFT so creator can fix and resubmit
    election.status = ElectionStatus.DRAFT

    await record_audit_log(
        db,
        election_id=election.id,
        user_id=user.id,
        action="ELECTION_REJECTED",
        details={"rejected_by": str(user.id), "reason": reason.strip(), "new_status": "DRAFT"},
    )

    await db.commit()
    updated = await get_election_by_id(db, election.id)
    if updated is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Election not found.")
    return updated


async def super_admin_final_approval(
    db: AsyncSession,
    election_id: uuid.UUID,
    admin_user: User,
) -> Election:
    if admin_user.role != UserRole.SUPER_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Super Admin final approval requires SUPER_ADMIN role.",
        )

    election = await get_election_by_id(db, election_id)
    if not election:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Election not found.",
        )

    if election.status not in (
        ElectionStatus.PENDING_APPROVAL,
        ElectionStatus.OFFICIAL_REVIEW,
        ElectionStatus.SUPER_ADMIN_FINAL_APPROVAL,
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Election cannot receive final approval in '{election.status.value}' status.",
        )

    # Verify that all assigned officials have approved
    assigned_user_ids = {a.user_id for a in election.official_assignments}
    approved_user_ids = {
        apprv.user_id
        for apprv in election.approvals
        if apprv.approval_status == "APPROVED"
    }

    pending_officials = assigned_user_ids - approved_user_ids
    if pending_officials:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="All required assigned Election Officials must approve before Super Admin final approval.",
        )

    # Determine next status based on schedule
    now = datetime.now(timezone.utc)
    if election.start_at and election.start_at > now:
        new_status = ElectionStatus.SCHEDULED
    else:
        new_status = ElectionStatus.APPROVED

    election.status = new_status

    # Record super admin approval
    admin_approval = (
        await db.execute(
            select(ElectionApproval).where(
                ElectionApproval.election_id == election.id,
                ElectionApproval.user_id == admin_user.id,
            )
        )
    ).scalar_one_or_none()

    if admin_approval is None:
        admin_approval = ElectionApproval(
            id=uuid.uuid4(),
            election_id=election.id,
            user_id=admin_user.id,
            approval_status="APPROVED",
            comment="Super Admin Final Approval granted.",
            approved_at=datetime.now(timezone.utc),
        )
        db.add(admin_approval)
    else:
        admin_approval.approval_status = "APPROVED"
        admin_approval.comment = "Super Admin Final Approval granted."
        admin_approval.approved_at = datetime.now(timezone.utc)

    await record_audit_log(
        db,
        election_id=election.id,
        user_id=admin_user.id,
        action="ELECTION_FINAL_APPROVED",
        details={
            "admin_id": str(admin_user.id),
            "final_status": new_status.value,
        },
    )

    await db.commit()
    updated = await get_election_by_id(db, election.id)
    if updated is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Election not found.")
    return updated
