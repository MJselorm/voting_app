import uuid
from datetime import datetime, timezone
from dataclasses import dataclass

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
    OrganizationMembershipVerification,
    OrganizationManagementAssignment,
    OrganizationManagementRole,
    MembershipVerificationMode,
    MembershipVerificationStatus,
    OrganizationStatus,
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
            detail="This operation conflicts with an existing membership, request, or invitation.",
        ) from error


@dataclass(frozen=True)
class MembershipAction:
    status: str
    membership: OrganizationMembership | None = None
    request: OrganizationMembershipRequest | None = None
    verification: OrganizationMembershipVerification | None = None


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
        ).order_by(
            OrganizationMembershipRequest.created_at.desc(),
            OrganizationMembershipRequest.id.desc(),
        )
    )
    verification = db.scalar(
        select(OrganizationMembershipVerification).where(
            OrganizationMembershipVerification.organization_id == organization.id,
            OrganizationMembershipVerification.user_id == user.id,
        ).order_by(
            OrganizationMembershipVerification.created_at.desc(),
            OrganizationMembershipVerification.id,
        )
    )
    return {
        "organization_id": organization.id,
        "membership_status": membership.status if membership else None,
        "membership_request_status": request.status if request else None,
        "membership_verification_status": verification.status if verification else None,
        "can_manage": is_organization_administrator(db, organization.id, user.id),
    }


def _assert_active_organization(organization: Organization) -> None:
    if organization.status != OrganizationStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only active organisations accept membership activity.",
        )


def _ensure_not_member(db: Session, organization: Organization, user: User) -> None:
    membership = db.scalar(
        select(OrganizationMembership).where(
            OrganizationMembership.organization_id == organization.id,
            OrganizationMembership.user_id == user.id,
            OrganizationMembership.status == MembershipStatus.ACTIVE,
        )
    )
    if membership:
        raise HTTPException(status_code=409, detail="You are already an active member.")


def _email_matches_domains(email: str, domains: list[str]) -> bool:
    email_domain = email.rpartition("@")[2].lower()
    return any(
        email_domain == domain or email_domain.endswith(f".{domain}")
        for domain in domains
    )


def require_institutional_email(email: str, domains: list[str]) -> None:
    if not _email_matches_domains(email, domains):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Use an email address from an approved institutional domain.",
        )


def create_membership_verification(
    db: Session,
    organization: Organization,
    user: User,
    *,
    mode: MembershipVerificationMode,
    requires_approval: bool,
    email_domains: list[str],
    note: str | None,
    request: OrganizationMembershipRequest | None = None,
    invitation_id: uuid.UUID | None = None,
) -> OrganizationMembershipVerification | None:
    if mode == MembershipVerificationMode.NONE:
        return None

    verified = mode == MembershipVerificationMode.INSTITUTIONAL_EMAIL
    if verified:
        require_institutional_email(user.email, email_domains)

    verification = OrganizationMembershipVerification(
        organization_id=organization.id,
        user_id=user.id,
        membership_request_id=request.id if request else None,
        invitation_id=invitation_id,
        verification_mode=mode,
        status=(
            MembershipVerificationStatus.VERIFIED
            if verified
            else MembershipVerificationStatus.PENDING
        ),
        membership_requires_approval=requires_approval,
        verified_email_domains=email_domains,
        submission_note=note,
        reviewed_at=_now() if verified else None,
    )
    db.add(verification)
    db.flush()
    return verification


def create_active_membership(
    db: Session,
    organization: Organization,
    user: User,
    *,
    assigned_by: User | None = None,
) -> OrganizationMembership:
    membership = db.scalar(
        select(OrganizationMembership).where(
            OrganizationMembership.organization_id == organization.id,
            OrganizationMembership.user_id == user.id,
        )
    )
    if membership is None:
        membership = OrganizationMembership(
            organization_id=organization.id,
            user_id=user.id,
            status=MembershipStatus.ACTIVE,
        )
        db.add(membership)
        db.flush()
    else:
        membership.status = MembershipStatus.ACTIVE
        membership.reviewed_by = assigned_by.id if assigned_by else None
        membership.reviewed_at = _now() if assigned_by else None
        membership.updated_at = _now()

    role_assignment = db.scalar(
        select(OrganizationRoleAssignment).where(
            OrganizationRoleAssignment.organization_id == organization.id,
            OrganizationRoleAssignment.user_id == user.id,
            OrganizationRoleAssignment.role == OrganizationRole.MEMBER,
        )
    )
    if role_assignment is None:
        db.add(
            OrganizationRoleAssignment(
                organization_id=organization.id,
                user_id=user.id,
                role=OrganizationRole.MEMBER,
                status=AssignmentStatus.ACTIVE,
                assigned_by=(assigned_by or user).id,
            )
        )
    else:
        role_assignment.status = AssignmentStatus.ACTIVE
        role_assignment.revoked_at = None
        role_assignment.assigned_by = (assigned_by or user).id
    db.flush()
    return membership


def submit_membership_request(
    db: Session,
    organization: Organization,
    user: User,
    message: str | None,
    verification_note: str | None = None,
) -> tuple[OrganizationMembershipRequest, OrganizationMembershipVerification | None]:
    _assert_active_organization(organization)
    if organization.membership_requires_invitation:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="A valid organisation invitation is required to join.",
        )
    if not organization.membership_requires_approval:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This organisation allows direct joining. Use the join action instead.",
        )
    _ensure_not_member(db, organization, user)
    pending_verification = db.scalar(
        select(OrganizationMembershipVerification).where(
            OrganizationMembershipVerification.organization_id == organization.id,
            OrganizationMembershipVerification.user_id == user.id,
            OrganizationMembershipVerification.status == MembershipVerificationStatus.PENDING,
        )
    )
    if pending_verification:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An institutional verification request is already pending.",
        )
    existing_pending = db.scalar(
        select(OrganizationMembershipRequest).where(
            OrganizationMembershipRequest.organization_id == organization.id,
            OrganizationMembershipRequest.user_id == user.id,
            OrganizationMembershipRequest.status == MembershipRequestStatus.PENDING,
        ).order_by(OrganizationMembershipRequest.created_at.desc())
    )
    if existing_pending:
        if existing_pending.verification_mode == MembershipVerificationMode.ADMIN_REVIEW:
            latest_verification = db.scalar(
                select(OrganizationMembershipVerification).where(
                    OrganizationMembershipVerification.membership_request_id
                    == existing_pending.id,
                ).order_by(OrganizationMembershipVerification.created_at.desc())
            )
            if (
                latest_verification
                and latest_verification.status == MembershipVerificationStatus.REJECTED
            ):
                verification = create_membership_verification(
                    db,
                    organization,
                    user,
                    mode=existing_pending.verification_mode,
                    requires_approval=existing_pending.membership_requires_approval,
                    email_domains=existing_pending.verified_email_domains,
                    note=verification_note,
                    request=existing_pending,
                    invitation_id=existing_pending.invitation_id,
                )
                db.add(OrganizationAuditLog(
                    organization_id=organization.id,
                    actor_user_id=user.id,
                    action="ORGANIZATION_MEMBERSHIP_VERIFICATION_SUBMITTED",
                    details={"verification_id": str(verification.id)},
                ))
                _commit(db)
                db.refresh(existing_pending)
                return existing_pending, verification
        raise HTTPException(status_code=409, detail="A membership request is already pending.")

    request = OrganizationMembershipRequest(
        organization_id=organization.id,
        user_id=user.id,
        status=MembershipRequestStatus.PENDING,
        message=message,
        membership_requires_approval=organization.membership_requires_approval,
        membership_requires_invitation=organization.membership_requires_invitation,
        verification_mode=organization.membership_verification_mode,
        verified_email_domains=list(organization.membership_verified_email_domains),
    )
    db.add(request)
    db.flush()
    verification = create_membership_verification(
        db,
        organization,
        user,
        mode=request.verification_mode,
        requires_approval=request.membership_requires_approval,
        email_domains=request.verified_email_domains,
        note=verification_note,
        request=request,
    )
    db.add(OrganizationAuditLog(
        organization_id=organization.id,
        actor_user_id=user.id,
        action="ORGANIZATION_MEMBERSHIP_REQUESTED",
        details={"request_id": str(request.id)},
    ))
    if verification and verification.status == MembershipVerificationStatus.VERIFIED:
        db.add(OrganizationAuditLog(
            organization_id=organization.id,
            actor_user_id=user.id,
            action="ORGANIZATION_MEMBERSHIP_EMAIL_VERIFIED",
            details={"verification_id": str(verification.id)},
        ))
    elif verification:
        db.add(OrganizationAuditLog(
            organization_id=organization.id,
            actor_user_id=user.id,
            action="ORGANIZATION_MEMBERSHIP_VERIFICATION_SUBMITTED",
            details={"verification_id": str(verification.id)},
        ))
    _commit(db)
    db.refresh(request)
    return request, verification


def join_open_organization(
    db: Session,
    organization: Organization,
    user: User,
    verification_note: str | None = None,
) -> MembershipAction:
    _assert_active_organization(organization)
    if organization.membership_requires_invitation:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="A valid organisation invitation is required to join.",
        )
    if organization.membership_requires_approval:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This organisation requires administrator approval. Submit a membership request.",
        )
    _ensure_not_member(db, organization, user)
    pending_request = db.scalar(
        select(OrganizationMembershipRequest).where(
            OrganizationMembershipRequest.organization_id == organization.id,
            OrganizationMembershipRequest.user_id == user.id,
            OrganizationMembershipRequest.status == MembershipRequestStatus.PENDING,
        )
    )
    if pending_request:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A membership request is awaiting administrator review.",
        )

    latest_verification = db.scalar(
        select(OrganizationMembershipVerification).where(
            OrganizationMembershipVerification.organization_id == organization.id,
            OrganizationMembershipVerification.user_id == user.id,
        ).order_by(
            OrganizationMembershipVerification.created_at.desc(),
            OrganizationMembershipVerification.id.desc(),
        )
    )
    if (
        latest_verification
        and latest_verification.status == MembershipVerificationStatus.PENDING
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An institutional verification request is already pending.",
        )

    verification = create_membership_verification(
        db,
        organization,
        user,
        mode=organization.membership_verification_mode,
        requires_approval=False,
        email_domains=list(organization.membership_verified_email_domains),
        note=verification_note,
    )
    if verification and verification.status == MembershipVerificationStatus.PENDING:
        db.add(OrganizationAuditLog(
            organization_id=organization.id,
            actor_user_id=user.id,
            action="ORGANIZATION_MEMBERSHIP_VERIFICATION_SUBMITTED",
            details={"verification_id": str(verification.id)},
        ))
        _commit(db)
        db.refresh(verification)
        return MembershipAction(status="PENDING_VERIFICATION", verification=verification)

    membership = create_active_membership(db, organization, user)
    db.add(OrganizationAuditLog(
        organization_id=organization.id,
        actor_user_id=user.id,
        action="ORGANIZATION_MEMBERSHIP_JOINED",
        details={"membership_id": str(membership.id)},
    ))
    if verification:
        db.add(OrganizationAuditLog(
            organization_id=organization.id,
            actor_user_id=user.id,
            action="ORGANIZATION_MEMBERSHIP_EMAIL_VERIFIED",
            details={"verification_id": str(verification.id)},
        ))
    _commit(db)
    db.refresh(membership)
    return MembershipAction(
        status="ACTIVE",
        membership=membership,
        verification=verification,
    )


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
            OrganizationMembershipRequest.id.desc(),
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

    if request.membership_requires_invitation and request.invitation_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This membership request does not have a valid invitation.",
        )
    if request.verification_mode != MembershipVerificationMode.NONE:
        verification = db.scalar(
            select(OrganizationMembershipVerification).where(
                OrganizationMembershipVerification.membership_request_id == request.id,
            ).order_by(
                OrganizationMembershipVerification.created_at.desc(),
                OrganizationMembershipVerification.id.desc(),
            )
        )
        if (
            verification is None
            or verification.status != MembershipVerificationStatus.VERIFIED
        ):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Institutional verification must be completed before approval.",
            )

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
    pending_verification = db.scalar(
        select(OrganizationMembershipVerification).where(
            OrganizationMembershipVerification.membership_request_id == request.id,
            OrganizationMembershipVerification.status == MembershipVerificationStatus.PENDING,
        )
    )
    if pending_verification:
        pending_verification.status = MembershipVerificationStatus.CANCELLED
        pending_verification.rejection_reason = "The membership request was declined."
        pending_verification.reviewed_by = reviewer.id
        pending_verification.reviewed_at = _now()
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
