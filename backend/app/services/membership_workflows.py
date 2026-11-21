import hashlib
import hmac
import secrets
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.organization import (
    MembershipRequestStatus,
    MembershipVerificationMode,
    MembershipVerificationStatus,
    NotificationDeliveryStatus,
    Organization,
    OrganizationAuditLog,
    OrganizationInvitation,
    OrganizationInvitationStatus,
    OrganizationMembership,
    OrganizationMembershipRequest,
    OrganizationMembershipVerification,
    OrganizationManagementAssignment,
    OrganizationManagementRole,
)
from app.auth.permissions import AssignmentStatus, OrganizationRole
from app.models.rbac import OrganizationRoleAssignment
from app.models.user import User
from app.schemas.organization import OrganizationMembershipPolicyUpdate
from app.services.notifications import send_email
from app.services.memberships import (
    MembershipAction,
    _commit,
    _now,
    _ensure_not_member,
    _assert_active_organization,
    create_active_membership,
    create_membership_verification,
    require_organization_administrator,
    require_institutional_email,
)


@dataclass(frozen=True)
class InvitationIssue:
    invitation: OrganizationInvitation
    invitation_url: str
    notification_delivery: NotificationDeliveryStatus


@dataclass(frozen=True)
class VerificationDecision:
    verification: OrganizationMembershipVerification
    membership: OrganizationMembership | None = None


def update_membership_policy(
    db: Session,
    organization: Organization,
    admin: User,
    policy: OrganizationMembershipPolicyUpdate,
) -> Organization:
    _assert_active_organization(organization)
    require_organization_administrator(db, organization, admin)

    previous_policy = {
        "requires_approval": organization.membership_requires_approval,
        "requires_invitation": organization.membership_requires_invitation,
        "verification_mode": organization.membership_verification_mode.value,
        "verified_email_domains": list(organization.membership_verified_email_domains),
    }
    organization.membership_requires_approval = policy.membership_requires_approval
    organization.membership_requires_invitation = policy.membership_requires_invitation
    organization.membership_verification_mode = policy.verification_mode
    organization.membership_verified_email_domains = list(policy.verified_email_domains)
    organization.membership_verification_instructions = policy.verification_instructions

    db.add(OrganizationAuditLog(
        organization_id=organization.id,
        actor_user_id=admin.id,
        action="ORGANIZATION_MEMBERSHIP_POLICY_UPDATED",
        details={
            "previous": previous_policy,
            "current": {
                "requires_approval": policy.membership_requires_approval,
                "requires_invitation": policy.membership_requires_invitation,
                "verification_mode": policy.verification_mode.value,
                "verified_email_domains": policy.verified_email_domains,
            },
        },
    ))
    _commit(db)
    db.refresh(organization)
    return organization


def list_organization_administrator_emails(
    db: Session,
    organization_id: uuid.UUID,
) -> list[str]:
    role_emails = db.scalars(
        select(User.email)
        .join(
            OrganizationRoleAssignment,
            OrganizationRoleAssignment.user_id == User.id,
        )
        .where(
            OrganizationRoleAssignment.organization_id == organization_id,
            OrganizationRoleAssignment.status == AssignmentStatus.ACTIVE,
            OrganizationRoleAssignment.role.in_(
                [OrganizationRole.ORGANISATION_OWNER, OrganizationRole.ORGANISATION_ADMIN]
            ),
            User.is_active.is_(True),
        )
    ).all()
    management_emails = db.scalars(
        select(User.email)
        .join(
            OrganizationManagementAssignment,
            OrganizationManagementAssignment.user_id == User.id,
        )
        .where(
            OrganizationManagementAssignment.organization_id == organization_id,
            OrganizationManagementAssignment.role.in_(
                [OrganizationManagementRole.OWNER, OrganizationManagementRole.ADMIN]
            ),
            User.is_active.is_(True),
        )
    ).all()
    return sorted({email.strip().lower() for email in [*role_emails, *management_emails]})


def _effective_verification_mode(
    current: MembershipVerificationMode,
    invitation_snapshot: MembershipVerificationMode,
) -> MembershipVerificationMode:
    order = {
        MembershipVerificationMode.NONE: 0,
        MembershipVerificationMode.INSTITUTIONAL_EMAIL: 1,
        MembershipVerificationMode.ADMIN_REVIEW: 2,
    }
    return max((current, invitation_snapshot), key=order.__getitem__)


def _is_expired(expires_at: datetime, now: datetime) -> bool:
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    return expires_at <= now


def _notify_invitation_expired(
    invitation: OrganizationInvitation,
) -> NotificationDeliveryStatus:
    app_url = get_settings().public_app_url
    return send_email(
        invitation.email,
        "Organisation invitation expired",
        f"The invitation to join organisation {invitation.organization_id} has expired. "
        f"Contact an organisation administrator at {app_url} if you still need access.",
    )


def _effective_email_domains(
    organization: Organization,
    invitation: OrganizationInvitation,
    mode: MembershipVerificationMode,
) -> list[str]:
    current_domains = set(organization.membership_verified_email_domains)
    snapshot_domains = set(invitation.verified_email_domains)
    if mode != MembershipVerificationMode.INSTITUTIONAL_EMAIL:
        return []
    if organization.membership_verification_mode == MembershipVerificationMode.INSTITUTIONAL_EMAIL:
        if invitation.verification_mode == MembershipVerificationMode.INSTITUTIONAL_EMAIL:
            return sorted(current_domains & snapshot_domains)
        return sorted(current_domains)
    return sorted(snapshot_domains)


def _email_for_invitation(
    user: User,
    invitation: OrganizationInvitation,
) -> None:
    if not hmac.compare_digest(user.email.strip().lower(), invitation.email):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Sign in with the email address this invitation was sent to.",
        )


def issue_organization_invitation(
    db: Session,
    organization: Organization,
    admin: User,
    email: str,
    expires_in_days: int,
) -> InvitationIssue:
    _assert_active_organization(organization)
    require_organization_administrator(db, organization, admin)
    email = email.strip().lower()
    if organization.membership_verification_mode == MembershipVerificationMode.INSTITUTIONAL_EMAIL:
        require_institutional_email(email, organization.membership_verified_email_domains)

    existing_membership_user = db.scalar(
        select(User).where(User.email == email, User.is_active.is_(True))
    )
    if existing_membership_user:
        _ensure_not_member(db, organization, existing_membership_user)

    now = _now()
    existing = db.scalar(
        select(OrganizationInvitation).where(
            OrganizationInvitation.organization_id == organization.id,
            OrganizationInvitation.email == email,
            OrganizationInvitation.status == OrganizationInvitationStatus.PENDING,
        )
    )
    if existing and _is_expired(existing.expires_at, now):
        existing.status = OrganizationInvitationStatus.EXPIRED
        existing.updated_at = now
        expired_invitation = existing
        existing = None
        db.flush()
        db.add(OrganizationAuditLog(
            organization_id=organization.id,
            actor_user_id=admin.id,
            action="ORGANIZATION_INVITATION_EXPIRED",
            details={"invitation_id": str(expired_invitation.id)},
        ))
        _commit(db)
        _notify_invitation_expired(expired_invitation)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A pending invitation already exists for this email.",
        )

    token = secrets.token_urlsafe(32)
    invitation = OrganizationInvitation(
        organization_id=organization.id,
        email=email,
        token_hash=hashlib.sha256(token.encode("utf-8")).hexdigest(),
        status=OrganizationInvitationStatus.PENDING,
        expires_at=now + timedelta(days=expires_in_days),
        invited_by=admin.id,
        membership_requires_approval=organization.membership_requires_approval,
        verification_mode=organization.membership_verification_mode,
        verified_email_domains=list(organization.membership_verified_email_domains),
    )
    db.add(invitation)
    db.flush()
    db.add(OrganizationAuditLog(
        organization_id=organization.id,
        actor_user_id=admin.id,
        action="ORGANIZATION_INVITATION_ISSUED",
        details={"invitation_id": str(invitation.id), "email": email},
    ))
    _commit(db)
    db.refresh(invitation)
    delivery = send_email(
        email,
        f"Invitation to join {organization.name}",
        f"You have been invited to join {organization.name}. Accept your invitation here: "
        f"{get_settings().public_app_url}/app/organizations/{organization.id}"
        f"?{urlencode({'invitation_token': token})}",
    )

    query = urlencode({"invitation_token": token})
    invitation_url = (
        f"{get_settings().public_app_url}/app/organizations/"
        f"{organization.id}?{query}"
    )
    return InvitationIssue(
        invitation=invitation,
        invitation_url=invitation_url,
        notification_delivery=delivery,
    )


def list_organization_invitations(
    db: Session,
    organization: Organization,
    admin: User,
) -> list[tuple[OrganizationInvitation, NotificationDeliveryStatus | None]]:
    require_organization_administrator(db, organization, admin)
    invitations = list(db.scalars(
        select(OrganizationInvitation)
        .where(OrganizationInvitation.organization_id == organization.id)
        .order_by(OrganizationInvitation.created_at.desc())
        .limit(100)
    ))
    now = _now()
    expired: list[OrganizationInvitation] = []
    for invitation in invitations:
        if (
            invitation.status == OrganizationInvitationStatus.PENDING
            and _is_expired(invitation.expires_at, now)
        ):
            invitation.status = OrganizationInvitationStatus.EXPIRED
            invitation.updated_at = now
            expired.append(invitation)
            db.add(OrganizationAuditLog(
                organization_id=organization.id,
                actor_user_id=admin.id,
                action="ORGANIZATION_INVITATION_EXPIRED",
                details={"invitation_id": str(invitation.id)},
            ))
    if expired:
        _commit(db)
    delivery_by_id = {
        invitation.id: _notify_invitation_expired(invitation)
        for invitation in expired
    }
    return [(invitation, delivery_by_id.get(invitation.id)) for invitation in invitations]


def revoke_organization_invitation(
    db: Session,
    organization: Organization,
    invitation_id: uuid.UUID,
    admin: User,
) -> OrganizationInvitation:
    require_organization_administrator(db, organization, admin)
    invitation = db.get(OrganizationInvitation, invitation_id)
    if invitation is None or invitation.organization_id != organization.id:
        raise HTTPException(status_code=404, detail="Invitation not found.")
    if invitation.status != OrganizationInvitationStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only pending invitations can be revoked.",
        )
    now = _now()
    if _is_expired(invitation.expires_at, now):
        invitation.status = OrganizationInvitationStatus.EXPIRED
        invitation.updated_at = now
        db.add(OrganizationAuditLog(
            organization_id=organization.id,
            actor_user_id=admin.id,
            action="ORGANIZATION_INVITATION_EXPIRED",
            details={"invitation_id": str(invitation.id)},
        ))
        _commit(db)
        _notify_invitation_expired(invitation)
        raise HTTPException(status_code=410, detail="This invitation has expired.")

    invitation.status = OrganizationInvitationStatus.REVOKED
    invitation.revoked_at = now
    invitation.updated_at = now
    db.add(OrganizationAuditLog(
        organization_id=organization.id,
        actor_user_id=admin.id,
        action="ORGANIZATION_INVITATION_REVOKED",
        details={"invitation_id": str(invitation.id)},
    ))
    _commit(db)
    db.refresh(invitation)
    return invitation


def accept_organization_invitation(
    db: Session,
    organization: Organization,
    user: User,
    token: str,
    verification_note: str | None = None,
) -> tuple[OrganizationInvitation, MembershipAction]:
    _assert_active_organization(organization)
    digest = hashlib.sha256(token.encode("utf-8")).hexdigest()
    invitation = db.scalar(
        select(OrganizationInvitation).where(
            OrganizationInvitation.organization_id == organization.id,
            OrganizationInvitation.token_hash == digest,
        )
    )
    if invitation is None or not hmac.compare_digest(invitation.token_hash, digest):
        raise HTTPException(status_code=404, detail="Invitation not found.")
    _email_for_invitation(user, invitation)

    now = _now()
    if invitation.status == OrganizationInvitationStatus.PENDING and _is_expired(invitation.expires_at, now):
        invitation.status = OrganizationInvitationStatus.EXPIRED
        invitation.updated_at = now
        db.add(OrganizationAuditLog(
            organization_id=organization.id,
            actor_user_id=None,
            action="ORGANIZATION_INVITATION_EXPIRED",
            details={"invitation_id": str(invitation.id)},
        ))
        _commit(db)
        _notify_invitation_expired(invitation)
        raise HTTPException(status_code=410, detail="This invitation has expired.")
    if invitation.status == OrganizationInvitationStatus.REVOKED:
        raise HTTPException(status_code=410, detail="This invitation was revoked.")
    if invitation.status == OrganizationInvitationStatus.EXPIRED:
        raise HTTPException(status_code=410, detail="This invitation has expired.")
    if (
        invitation.status == OrganizationInvitationStatus.ACCEPTED
        and invitation.accepted_by != user.id
    ):
        raise HTTPException(status_code=409, detail="This invitation has already been accepted.")

    _ensure_not_member(db, organization, user)
    requires_approval = (
        organization.membership_requires_approval
        or invitation.membership_requires_approval
    )
    verification_mode = _effective_verification_mode(
        organization.membership_verification_mode,
        invitation.verification_mode,
    )
    domains = _effective_email_domains(organization, invitation, verification_mode)
    if verification_mode == MembershipVerificationMode.INSTITUTIONAL_EMAIL:
        if not domains:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="The invitation and current policy have incompatible email-domain requirements.",
            )
        require_institutional_email(user.email, domains)

    pending_request = db.scalar(
        select(OrganizationMembershipRequest).where(
            OrganizationMembershipRequest.organization_id == organization.id,
            OrganizationMembershipRequest.user_id == user.id,
            OrganizationMembershipRequest.status == MembershipRequestStatus.PENDING,
        ).order_by(OrganizationMembershipRequest.created_at.desc())
    )
    if pending_request and pending_request.invitation_id != invitation.id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A membership request is already pending for this organisation.",
        )
    pending_verification = db.scalar(
        select(OrganizationMembershipVerification).where(
            OrganizationMembershipVerification.organization_id == organization.id,
            OrganizationMembershipVerification.user_id == user.id,
            OrganizationMembershipVerification.status == MembershipVerificationStatus.PENDING,
        )
    )
    if pending_verification and pending_verification.invitation_id != invitation.id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An institutional verification request is already pending.",
        )
    if (
        pending_verification
        and pending_verification.membership_request_id is None
    ):
        if invitation.status == OrganizationInvitationStatus.PENDING:
            invitation.status = OrganizationInvitationStatus.ACCEPTED
            invitation.accepted_by = user.id
            invitation.accepted_at = now
            invitation.updated_at = now
        db.add(OrganizationAuditLog(
            organization_id=organization.id,
            actor_user_id=user.id,
            action="ORGANIZATION_INVITATION_ACCEPTED",
            details={
                "invitation_id": str(invitation.id),
                "verification_id": str(pending_verification.id),
            },
        ))
        _commit(db)
        db.refresh(invitation)
        db.refresh(pending_verification)
        return invitation, MembershipAction(
            status="PENDING_VERIFICATION",
            verification=pending_verification,
        )
    requires_approval = requires_approval or bool(
        pending_request and pending_request.membership_requires_approval
    )
    if requires_approval:
        request = pending_request or OrganizationMembershipRequest(
            organization_id=organization.id,
            user_id=user.id,
            status=MembershipRequestStatus.PENDING,
            membership_requires_approval=True,
            membership_requires_invitation=True,
            verification_mode=verification_mode,
            verified_email_domains=domains,
            invitation_id=invitation.id,
        )
        if pending_request is None:
            db.add(request)
            db.flush()

        latest_verification = db.scalar(
            select(OrganizationMembershipVerification).where(
                OrganizationMembershipVerification.membership_request_id == request.id,
            ).order_by(OrganizationMembershipVerification.created_at.desc())
        )
        if (
            latest_verification
            and latest_verification.status in {
                MembershipVerificationStatus.PENDING,
                MembershipVerificationStatus.VERIFIED,
            }
        ):
            action_status = (
                "PENDING_VERIFICATION"
                if latest_verification.status == MembershipVerificationStatus.PENDING
                else "PENDING_APPROVAL"
            )
            action = MembershipAction(
                status=action_status,
                request=request,
                verification=latest_verification,
            )
        else:
            verification = create_membership_verification(
                db,
                organization,
                user,
                mode=verification_mode,
                requires_approval=True,
                email_domains=domains,
                note=verification_note,
                request=request,
                invitation_id=invitation.id,
            )
            action = MembershipAction(
                status=(
                    "PENDING_VERIFICATION"
                    if verification and verification.status == MembershipVerificationStatus.PENDING
                    else "PENDING_APPROVAL"
                ),
                request=request,
                verification=verification,
            )
        audit_action = (
            "ORGANIZATION_MEMBERSHIP_REQUESTED"
            if pending_request is None
            else "ORGANIZATION_INVITATION_ACCEPTED"
        )
        db.add(OrganizationAuditLog(
            organization_id=organization.id,
            actor_user_id=user.id,
            action=audit_action,
            details={
                "invitation_id": str(invitation.id),
                "request_id": str(request.id),
            },
        ))
    elif verification_mode == MembershipVerificationMode.ADMIN_REVIEW:
        latest_verification = db.scalar(
            select(OrganizationMembershipVerification).where(
                OrganizationMembershipVerification.organization_id == organization.id,
                OrganizationMembershipVerification.user_id == user.id,
                OrganizationMembershipVerification.invitation_id == invitation.id,
            ).order_by(OrganizationMembershipVerification.created_at.desc())
        )
        if latest_verification and latest_verification.status == MembershipVerificationStatus.PENDING:
            action = MembershipAction(
                status="PENDING_VERIFICATION",
                verification=latest_verification,
            )
        else:
            verification = create_membership_verification(
                db,
                organization,
                user,
                mode=verification_mode,
                requires_approval=False,
                email_domains=[],
                note=verification_note,
                invitation_id=invitation.id,
            )
            action = MembershipAction(
                status="PENDING_VERIFICATION",
                verification=verification,
            )
            db.add(OrganizationAuditLog(
                organization_id=organization.id,
                actor_user_id=user.id,
                action="ORGANIZATION_MEMBERSHIP_VERIFICATION_SUBMITTED",
                details={
                    "invitation_id": str(invitation.id),
                    "verification_id": str(verification.id),
                },
            ))
    else:
        verification = create_membership_verification(
            db,
            organization,
            user,
            mode=verification_mode,
            requires_approval=False,
            email_domains=domains,
            note=verification_note,
            invitation_id=invitation.id,
        )
        membership = create_active_membership(db, organization, user)
        action = MembershipAction(
            status="ACTIVE",
            membership=membership,
            verification=verification,
        )
        db.add(OrganizationAuditLog(
            organization_id=organization.id,
            actor_user_id=user.id,
            action="ORGANIZATION_MEMBERSHIP_JOINED",
            details={
                "invitation_id": str(invitation.id),
                "membership_id": str(membership.id),
            },
        ))

    if invitation.status == OrganizationInvitationStatus.PENDING:
        invitation.status = OrganizationInvitationStatus.ACCEPTED
        invitation.accepted_by = user.id
        invitation.accepted_at = now
        invitation.updated_at = now
    _commit(db)
    if action.membership:
        db.refresh(action.membership)
    if action.request:
        db.refresh(action.request)
    if action.verification:
        db.refresh(action.verification)
    db.refresh(invitation)
    return invitation, action


def list_membership_verifications(
    db: Session,
    organization: Organization,
    admin: User,
    *,
    status_filter: MembershipVerificationStatus | None,
    offset: int,
    limit: int,
) -> list[tuple[OrganizationMembershipVerification, User | None]]:
    require_organization_administrator(db, organization, admin)
    statement = select(OrganizationMembershipVerification).where(
        OrganizationMembershipVerification.organization_id == organization.id
    )
    if status_filter is not None:
        statement = statement.where(
            OrganizationMembershipVerification.status == status_filter
        )
    verifications = db.scalars(
        statement.order_by(
            OrganizationMembershipVerification.created_at.desc(),
            OrganizationMembershipVerification.id.desc(),
        ).offset(offset).limit(limit)
    ).all()
    return [(verification, db.get(User, verification.user_id)) for verification in verifications]


def review_membership_verification(
    db: Session,
    organization: Organization,
    verification_id: uuid.UUID,
    reviewer: User,
    *,
    approved: bool,
    reason: str | None = None,
) -> VerificationDecision:
    require_organization_administrator(db, organization, reviewer)
    verification = db.get(OrganizationMembershipVerification, verification_id)
    if verification is None or verification.organization_id != organization.id:
        raise HTTPException(status_code=404, detail="Membership verification was not found.")
    if verification.status != MembershipVerificationStatus.PENDING:
        raise HTTPException(status_code=409, detail="Only pending verifications can be reviewed.")
    if verification.user_id == reviewer.id:
        raise HTTPException(
            status_code=403,
            detail="Administrators cannot verify their own membership.",
        )
    if verification.verification_mode != MembershipVerificationMode.ADMIN_REVIEW:
        raise HTTPException(
            status_code=409,
            detail="Only administrator-assisted verifications can be reviewed here.",
        )

    now = _now()
    verification.status = (
        MembershipVerificationStatus.VERIFIED
        if approved
        else MembershipVerificationStatus.REJECTED
    )
    verification.reviewed_by = reviewer.id
    verification.reviewed_at = now
    verification.rejection_reason = None if approved else reason

    membership = None
    if approved and not verification.membership_requires_approval:
        member = db.get(User, verification.user_id)
        if member is None or not member.is_active:
            raise HTTPException(status_code=404, detail="The applicant is no longer active.")
        membership = create_active_membership(
            db,
            organization,
            member,
            assigned_by=reviewer,
        )
        db.add(OrganizationAuditLog(
            organization_id=organization.id,
            actor_user_id=reviewer.id,
            action="ORGANIZATION_MEMBERSHIP_JOINED",
            details={
                "verification_id": str(verification.id),
                "membership_id": str(membership.id),
            },
        ))

    db.add(OrganizationAuditLog(
        organization_id=organization.id,
        actor_user_id=reviewer.id,
        action=(
            "ORGANIZATION_MEMBERSHIP_VERIFICATION_APPROVED"
            if approved
            else "ORGANIZATION_MEMBERSHIP_VERIFICATION_REJECTED"
        ),
        details={"verification_id": str(verification.id)},
    ))
    _commit(db)
    db.refresh(verification)
    if membership:
        db.refresh(membership)
    return VerificationDecision(verification=verification, membership=membership)
