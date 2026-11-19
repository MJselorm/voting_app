import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.permissions import AssignmentStatus, OrganizationRole
from app.models.organization import (
    MembershipRequestStatus,
    MembershipStatus,
    Organization,
    OrganizationAuditLog,
    OrganizationMembership,
    OrganizationMembershipRequest,
    OrganizationManagementAssignment,
    OrganizationManagementRole,
)
from app.models.rbac import OrganizationRoleAssignment
from app.models.user import User


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _commit(db: Session) -> None:
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The membership already exists or is already pending.",
        ) from error


def is_organization_administrator(db: Session, organization_id: uuid.UUID, user_id: uuid.UUID) -> bool:
    rbac_assignment = db.scalar(
        select(OrganizationRoleAssignment.id).where(
            OrganizationRoleAssignment.organization_id == organization_id,
            OrganizationRoleAssignment.user_id == user_id,
            OrganizationRoleAssignment.status == AssignmentStatus.ACTIVE,
            OrganizationRoleAssignment.role.in_([
                OrganizationRole.ORGANISATION_OWNER,
                OrganizationRole.ORGANISATION_ADMIN,
            ]),
        )
    ) is not None
    if rbac_assignment:
        return True
    return db.scalar(
        select(OrganizationManagementAssignment.id).where(
            OrganizationManagementAssignment.organization_id == organization_id,
            OrganizationManagementAssignment.user_id == user_id,
            OrganizationManagementAssignment.role.in_([
                OrganizationManagementRole.OWNER,
                OrganizationManagementRole.ADMIN,
            ]),
        )
    ) is not None


def require_organization_administrator(db: Session, organization: Organization, user: User) -> None:
    if not is_organization_administrator(db, organization.id, user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Organisation owner or administrator access is required.",
        )


def get_membership_status(db: Session, organization: Organization, user: User) -> dict:
    membership = db.scalar(
        select(OrganizationMembership).where(
            OrganizationMembership.organization_id == organization.id,
            OrganizationMembership.user_id == user.id,
        )
    )
    request = db.scalar(
        select(OrganizationMembershipRequest).where(
            OrganizationMembershipRequest.organization_id == organization.id,
            OrganizationMembershipRequest.user_id == user.id,
        ).order_by(OrganizationMembershipRequest.created_at.desc())
    )
    return {
        "organization_id": organization.id,
        "membership_status": membership.status if membership else None,
        "membership_request_status": request.status if request else None,
        "can_manage": is_organization_administrator(db, organization.id, user.id),
    }


def submit_membership_request(
    db: Session,
    organization: Organization,
    user: User,
    message: str | None,
):
    if organization.status.value != "ACTIVE":
        raise HTTPException(status_code=409, detail="Only active organisations accept membership requests.")
    active_membership = db.scalar(
        select(OrganizationMembership).where(
            OrganizationMembership.organization_id == organization.id,
            OrganizationMembership.user_id == user.id,
            OrganizationMembership.status == MembershipStatus.ACTIVE,
        )
    )
    if active_membership:
        raise HTTPException(status_code=409, detail="You are already an active member.")
    existing = db.scalar(
        select(OrganizationMembershipRequest).where(
            OrganizationMembershipRequest.organization_id == organization.id,
            OrganizationMembershipRequest.user_id == user.id,
        )
    )
    if existing:
        if existing.status == MembershipRequestStatus.PENDING:
            raise HTTPException(status_code=409, detail="A membership request is already pending.")
        if existing.status == MembershipRequestStatus.APPROVED:
            raise HTTPException(status_code=409, detail="This membership request is already approved.")
        existing.status = MembershipRequestStatus.PENDING
        existing.message = message
        existing.rejection_reason = None
        existing.reviewed_by = None
        existing.reviewed_at = None
        existing.updated_at = _now()
    else:
        existing = OrganizationMembershipRequest(
            organization_id=organization.id,
            user_id=user.id,
            status=MembershipRequestStatus.PENDING,
            message=message,
        )
        db.add(existing)
    db.flush()
    db.add(OrganizationAuditLog(
        organization_id=organization.id,
        actor_user_id=user.id,
        action="ORGANIZATION_MEMBERSHIP_REQUESTED",
        details={"request_id": str(existing.id)},
    ))
    _commit(db)
    db.refresh(existing)
    return existing


def list_membership_requests(
    db: Session,
    organization: Organization,
    *,
    status_filter: MembershipRequestStatus | None,
    offset: int,
    limit: int,
):
    statement = select(OrganizationMembershipRequest).where(
        OrganizationMembershipRequest.organization_id == organization.id
    )
    if status_filter is not None:
        statement = statement.where(OrganizationMembershipRequest.status == status_filter)
    return list(db.scalars(
        statement.order_by(
            OrganizationMembershipRequest.created_at.desc(),
            OrganizationMembershipRequest.id,
        ).offset(offset).limit(limit)
    ))


def approve_membership_request(
    db: Session,
    organization: Organization,
    request: OrganizationMembershipRequest,
    reviewer: User,
):
    if request.status != MembershipRequestStatus.PENDING:
        raise HTTPException(status_code=409, detail="Only pending membership requests can be approved.")
    if request.user_id == reviewer.id:
        raise HTTPException(status_code=403, detail="Administrators cannot approve their own membership request.")

    membership = db.scalar(
        select(OrganizationMembership).where(
            OrganizationMembership.organization_id == organization.id,
            OrganizationMembership.user_id == request.user_id,
        )
    )
    if membership is None:
        membership = OrganizationMembership(
            organization_id=organization.id,
            user_id=request.user_id,
            status=MembershipStatus.ACTIVE,
            reviewed_by=reviewer.id,
            reviewed_at=_now(),
        )
        db.add(membership)
    else:
        if membership.status == MembershipStatus.ACTIVE:
            raise HTTPException(status_code=409, detail="The user is already an active member.")
        membership.status = MembershipStatus.ACTIVE
        membership.reviewed_by = reviewer.id
        membership.reviewed_at = _now()
        membership.updated_at = _now()

    request.status = MembershipRequestStatus.APPROVED
    request.reviewed_by = reviewer.id
    request.reviewed_at = _now()
    request.rejection_reason = None

    role_assignment = db.scalar(
        select(OrganizationRoleAssignment).where(
            OrganizationRoleAssignment.organization_id == organization.id,
            OrganizationRoleAssignment.user_id == request.user_id,
            OrganizationRoleAssignment.role == OrganizationRole.MEMBER,
        )
    )
    if role_assignment is None:
        db.add(OrganizationRoleAssignment(
            organization_id=organization.id,
            user_id=request.user_id,
            role=OrganizationRole.MEMBER,
            status=AssignmentStatus.ACTIVE,
            assigned_by=reviewer.id,
        ))
    else:
        role_assignment.status = AssignmentStatus.ACTIVE
        role_assignment.revoked_at = None
        role_assignment.assigned_by = reviewer.id

    db.add(OrganizationAuditLog(
        organization_id=organization.id,
        actor_user_id=reviewer.id,
        action="ORGANIZATION_MEMBERSHIP_APPROVED",
        details={"request_id": str(request.id), "member_user_id": str(request.user_id)},
    ))
    _commit(db)
    db.refresh(request)
    db.refresh(membership)
    return request


def reject_membership_request(
    db: Session,
    organization: Organization,
    request: OrganizationMembershipRequest,
    reviewer: User,
    reason: str,
):
    if request.status != MembershipRequestStatus.PENDING:
        raise HTTPException(status_code=409, detail="Only pending membership requests can be rejected.")
    if request.user_id == reviewer.id:
        raise HTTPException(status_code=403, detail="Administrators cannot reject their own membership request.")
    request.status = MembershipRequestStatus.REJECTED
    request.rejection_reason = reason
    request.reviewed_by = reviewer.id
    request.reviewed_at = _now()
    db.add(OrganizationAuditLog(
        organization_id=organization.id,
        actor_user_id=reviewer.id,
        action="ORGANIZATION_MEMBERSHIP_REJECTED",
        details={"request_id": str(request.id), "reason": reason},
    ))
    _commit(db)
    db.refresh(request)
    return request


def list_my_memberships(db: Session, user: User) -> list[OrganizationMembership]:
    return list(db.scalars(
        select(OrganizationMembership)
        .where(
            OrganizationMembership.user_id == user.id,
            OrganizationMembership.status == MembershipStatus.ACTIVE,
        )
        .order_by(OrganizationMembership.joined_at.desc())
    ))
