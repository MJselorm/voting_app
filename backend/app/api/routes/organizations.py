import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_active_user, get_platform_super_admin
from app.database.session import get_db
from app.models.organization import (
    MembershipRequestStatus,
    MembershipVerificationStatus,
    OrganizationInvitation,
    OrganizationMembershipRequest,
    OrganizationRequestStatus,
    OrganizationStatus,
)
from app.models.user import User
from app.schemas.organization import (
    OrganizationDirectCreate,
    OrganizationList,
    OrganizationManagementAssignmentResponse,
    OrganizationManagementUpdate,
    OrganizationReject,
    OrganizationRequestCreate,
    OrganizationRequestList,
    OrganizationRequestResponse,
    OrganizationResponse,
    OrganizationStatusResponse,
    OrganizationMembershipPolicy,
    OrganizationMembershipPolicyUpdate,
    OrganizationProfileUpdate,
    MembershipJoinResponse,
    MembershipRequestCreate,
    MembershipRequestReject,
    MembershipRequestList,
    MembershipRequestResponse,
    MembershipResponse,
    MembershipList,
    MembershipStatusResponse,
    MembershipVerificationCreate,
    MembershipVerificationReject,
    MembershipVerificationList,
    MembershipVerificationResponse,
    OrganizationInvitationAccept,
    OrganizationInvitationCreate,
    OrganizationInvitationList,
    OrganizationInvitationResponse,
)
from app.services.organizations import (
    approve_organization_request,
    change_organization_status,
    create_organization_directly,
    get_organization_or_404,
    get_request_or_404,
    is_organization_manager,
    list_all_organizations,
    list_discoverable_organizations,
    list_my_organizations,
    list_requests,
    reject_organization_request,
    submit_organization_request,
    update_initial_management,
    update_organization_profile,
)
from app.services.memberships import (
    approve_membership_request,
    get_membership_status,
    list_membership_requests,
    list_my_memberships,
    reject_membership_request,
    require_organization_administrator,
    submit_membership_request,
    join_open_organization,
)
from app.services.membership_workflows import (
    accept_organization_invitation,
    issue_organization_invitation,
    list_membership_verifications,
    list_organization_administrator_emails,
    list_organization_invitations,
    review_membership_verification,
    revoke_organization_invitation,
    update_membership_policy,
)
from app.services.notifications import send_email, send_email_to_many
from app.services.notification_engine import publish
from app.core.config import get_settings

organization_router = APIRouter(prefix="/v1/organizations", tags=["organisations"])
admin_router = APIRouter(prefix="/v1/admin", tags=["platform administration"])


@organization_router.post(
    "/requests",
    response_model=OrganizationRequestResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_organization_request(
    request_data: OrganizationRequestCreate,
    user: Annotated[User, Depends(get_active_user)],
    db: Annotated[Session, Depends(get_db)],
) -> OrganizationRequestResponse:
    return submit_organization_request(db, user, request_data)


@organization_router.get(
    "/requests/me",
    response_model=OrganizationRequestList,
)
def get_my_organization_requests(
    user: Annotated[User, Depends(get_active_user)],
    db: Annotated[Session, Depends(get_db)],
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
) -> OrganizationRequestList:
    return OrganizationRequestList(
        items=list_requests(
            db,
            requester_id=user.id,
            offset=offset,
            limit=limit,
        )
    )


@organization_router.get("", response_model=OrganizationList)
def discover_organizations(
    user: Annotated[User, Depends(get_active_user)],
    db: Annotated[Session, Depends(get_db)],
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
) -> OrganizationList:
    return OrganizationList(
        items=list_discoverable_organizations(db, offset=offset, limit=limit)
    )


@organization_router.get("/mine", response_model=OrganizationList)
def get_my_organizations(
    user: Annotated[User, Depends(get_active_user)],
    db: Annotated[Session, Depends(get_db)],
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
) -> OrganizationList:
    return OrganizationList(
        items=list_my_organizations(db, user_id=user.id, offset=offset, limit=limit)
    )


@organization_router.put("/{organization_id}/profile", response_model=OrganizationResponse)
def update_profile(organization_id: uuid.UUID, data: OrganizationProfileUpdate, user: Annotated[User, Depends(get_active_user)], db: Annotated[Session, Depends(get_db)]) -> OrganizationResponse:
    return update_organization_profile(db, get_organization_or_404(db, organization_id), user, data)


@organization_router.get("/membership/my", response_model=MembershipList)
def get_my_memberships(
    user: Annotated[User, Depends(get_active_user)],
    db: Annotated[Session, Depends(get_db)],
) -> MembershipList:
    memberships = list_my_memberships(db, user)
    items = []
    for membership in memberships:
        items.append(
            MembershipResponse(
                id=membership.id,
                organization_id=membership.organization_id,
                user_id=membership.user_id,
                status=membership.status,
                joined_at=membership.joined_at,
                reviewed_by=membership.reviewed_by,
                reviewed_at=membership.reviewed_at,
                role="MEMBER",
                organization_name=membership.organization.name,
                organization_type=membership.organization.organization_type,
            )
        )
    return MembershipList(items=items)


@organization_router.get("/{organization_id}/membership/status", response_model=MembershipStatusResponse)
def get_organization_membership_status(
    organization_id: uuid.UUID,
    user: Annotated[User, Depends(get_active_user)],
    db: Annotated[Session, Depends(get_db)],
) -> MembershipStatusResponse:
    organization = get_organization_or_404(db, organization_id)
    return MembershipStatusResponse.model_validate(
        get_membership_status(db, organization, user)
    )


@organization_router.post("/{organization_id}/membership-requests", response_model=MembershipRequestResponse)
def request_organization_membership(
    organization_id: uuid.UUID,
    data: MembershipRequestCreate,
    user: Annotated[User, Depends(get_active_user)],
    db: Annotated[Session, Depends(get_db)],
) -> MembershipRequestResponse:
    organization = get_organization_or_404(db, organization_id)
    request, _verification = submit_membership_request(
        db,
        organization,
        user,
        data.message,
        verification_note=data.verification_note,
    )
    delivery = send_email_to_many(
        list_organization_administrator_emails(db, organization.id),
        f"Membership request for {organization.name}",
        f"{user.full_name} ({user.email}) requested to join {organization.name}.\n"
        f"Review requests at {get_settings().public_app_url}/app/organizations/"
        f"{organization.id}",
    )
    return MembershipRequestResponse(
        id=request.id,
        organization_id=request.organization_id,
        user_id=request.user_id,
        status=request.status,
        message=request.message,
        reviewed_by=request.reviewed_by,
        reviewed_at=request.reviewed_at,
        rejection_reason=request.rejection_reason,
        created_at=request.created_at,
        updated_at=request.updated_at,
        applicant_name=user.full_name,
        applicant_email=user.email,
        notification_delivery=delivery,
    )


@organization_router.post(
    "/{organization_id}/membership/join",
    response_model=MembershipJoinResponse,
)
def join_organization(
    organization_id: uuid.UUID,
    data: MembershipVerificationCreate,
    user: Annotated[User, Depends(get_active_user)],
    db: Annotated[Session, Depends(get_db)],
) -> MembershipJoinResponse:
    organization = get_organization_or_404(db, organization_id)
    action = join_open_organization(
        db, organization, user, verification_note=data.note
    )
    delivery = None
    if action.status == "PENDING_VERIFICATION":
        delivery = send_email_to_many(
            list_organization_administrator_emails(db, organization.id),
            f"Membership verification needs review for {organization.name}",
            f"{user.full_name} ({user.email}) submitted membership verification.\n"
            f"Review it at {get_settings().public_app_url}/app/organizations/"
            f"{organization.id}",
        )
    return MembershipJoinResponse(
        status=action.status,
        membership_id=action.membership.id if action.membership else None,
        membership_request_id=action.request.id if action.request else None,
        verification_id=action.verification.id if action.verification else None,
        notification_delivery=delivery,
    )


@organization_router.put(
    "/{organization_id}/membership-policy",
    response_model=OrganizationMembershipPolicy,
)
def set_organization_membership_policy(
    organization_id: uuid.UUID,
    policy: OrganizationMembershipPolicyUpdate,
    user: Annotated[User, Depends(get_active_user)],
    db: Annotated[Session, Depends(get_db)],
) -> OrganizationMembershipPolicy:
    organization = get_organization_or_404(db, organization_id)
    updated = update_membership_policy(db, organization, user, policy)
    return OrganizationMembershipPolicy(
        membership_requires_approval=updated.membership_requires_approval,
        membership_requires_invitation=updated.membership_requires_invitation,
        verification_mode=updated.membership_verification_mode,
        verified_email_domains=updated.membership_verified_email_domains,
        verification_instructions=updated.membership_verification_instructions,
    )


@organization_router.post(
    "/{organization_id}/invitations/accept",
    response_model=MembershipJoinResponse,
)
def accept_invitation(
    organization_id: uuid.UUID,
    data: OrganizationInvitationAccept,
    user: Annotated[User, Depends(get_active_user)],
    db: Annotated[Session, Depends(get_db)],
) -> MembershipJoinResponse:
    organization = get_organization_or_404(db, organization_id)
    invitation, action = accept_organization_invitation(
        db,
        organization,
        user,
        data.token,
        verification_note=data.verification_note,
    )
    delivery = send_email_to_many(
        list_organization_administrator_emails(db, organization.id),
        f"Invitation accepted for {organization.name}",
        f"{user.full_name} ({user.email}) accepted an invitation to join "
        f"{organization.name}.\nReview membership activity at "
        f"{get_settings().public_app_url}/app/organizations/{organization.id}",
    )
    return MembershipJoinResponse(
        status=action.status,
        membership_id=action.membership.id if action.membership else None,
        membership_request_id=action.request.id if action.request else None,
        verification_id=action.verification.id if action.verification else None,
        notification_delivery=delivery,
    )


@organization_router.get("/{organization_id}", response_model=OrganizationResponse)
def get_organization_details(
    organization_id: uuid.UUID,
    user: Annotated[User, Depends(get_active_user)],
    db: Annotated[Session, Depends(get_db)],
) -> OrganizationResponse:
    organization = get_organization_or_404(db, organization_id)
    if organization.status == OrganizationStatus.ACTIVE and organization.is_public_profile:
        return organization
    if not user.is_platform_super_admin and not is_organization_manager(
        db, organization_id, user.id
    ):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organisation was not found.",
        )
    if not user.is_platform_super_admin and not is_organization_manager(
        db, organization_id, user.id
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not assigned to manage this organisation.",
        )
    return organization


@admin_router.get("/organizations", response_model=OrganizationList)
def get_all_organizations(
    admin: Annotated[User, Depends(get_platform_super_admin)],
    db: Annotated[Session, Depends(get_db)],
    organization_status: Annotated[
        OrganizationStatus | None,
        Query(alias="status"),
    ] = None,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
) -> OrganizationList:
    return OrganizationList(
        items=list_all_organizations(
            db,
            status_filter=organization_status,
            offset=offset,
            limit=limit,
        )
    )


@admin_router.get(
    "/organizations/{organization_id}/membership-requests",
    response_model=MembershipRequestList,
)
def get_membership_requests(
    organization_id: uuid.UUID,
    admin: Annotated[User, Depends(get_active_user)],
    db: Annotated[Session, Depends(get_db)],
    request_status: Annotated[
        MembershipRequestStatus | None,
        Query(alias="status"),
    ] = MembershipRequestStatus.PENDING,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
) -> MembershipRequestList:
    organization = get_organization_or_404(db, organization_id)
    require_organization_administrator(db, organization, admin)
    requests = list_membership_requests(
        db,
        organization,
        status_filter=request_status,
        offset=offset,
        limit=limit,
    )
    enriched_items = []
    for request in requests:
        applicant = db.get(User, request.user_id)
        enriched_items.append(
            MembershipRequestResponse(
                id=request.id,
                organization_id=request.organization_id,
                user_id=request.user_id,
                status=request.status,
                message=request.message,
                reviewed_by=request.reviewed_by,
                reviewed_at=request.reviewed_at,
                rejection_reason=request.rejection_reason,
                created_at=request.created_at,
                updated_at=request.updated_at,
                applicant_name=applicant.full_name if applicant else None,
                applicant_email=applicant.email if applicant else None,
            )
        )
    return MembershipRequestList(
        items=enriched_items
    )


@admin_router.post(
    "/organizations/{organization_id}/membership-requests/{request_id}/approve",
    response_model=MembershipRequestResponse,
)
def approve_membership_request_route(
    organization_id: uuid.UUID,
    request_id: uuid.UUID,
    admin: Annotated[User, Depends(get_active_user)],
    db: Annotated[Session, Depends(get_db)],
) -> MembershipRequestResponse:
    organization = get_organization_or_404(db, organization_id)
    require_organization_administrator(db, organization, admin)
    request = db.get(OrganizationMembershipRequest, request_id)
    if request is None or request.organization_id != organization.id:
        raise HTTPException(status_code=404, detail="Membership request was not found.")
    approved = approve_membership_request(db, organization, request, admin)
    applicant = db.get(User, approved.user_id)
    delivery = (
        send_email(
            applicant.email,
            f"Membership approved for {organization.name}",
            f"Your request to join {organization.name} has been approved.",
        )
        if applicant
        else None
    )
    return MembershipRequestResponse(
        id=approved.id,
        organization_id=approved.organization_id,
        user_id=approved.user_id,
        status=approved.status,
        message=approved.message,
        reviewed_by=approved.reviewed_by,
        reviewed_at=approved.reviewed_at,
        rejection_reason=approved.rejection_reason,
        created_at=approved.created_at,
        updated_at=approved.updated_at,
        applicant_name=applicant.full_name if applicant else None,
        applicant_email=applicant.email if applicant else None,
        notification_delivery=delivery,
    )


@admin_router.post(
    "/organizations/{organization_id}/membership-requests/{request_id}/reject",
    response_model=MembershipRequestResponse,
)
def reject_membership_request_route(
    organization_id: uuid.UUID,
    request_id: uuid.UUID,
    data: MembershipRequestReject,
    admin: Annotated[User, Depends(get_active_user)],
    db: Annotated[Session, Depends(get_db)],
) -> MembershipRequestResponse:
    organization = get_organization_or_404(db, organization_id)
    require_organization_administrator(db, organization, admin)
    request = db.get(OrganizationMembershipRequest, request_id)
    if request is None or request.organization_id != organization.id:
        raise HTTPException(status_code=404, detail="Membership request was not found.")
    rejected = reject_membership_request(db, organization, request, admin, data.reason)
    applicant = db.get(User, rejected.user_id)
    delivery = (
        send_email(
            applicant.email,
            f"Membership request update for {organization.name}",
            f"Your request to join {organization.name} was not approved.\n"
            f"Reason: {data.reason}",
        )
        if applicant
        else None
    )
    return MembershipRequestResponse(
        id=rejected.id,
        organization_id=rejected.organization_id,
        user_id=rejected.user_id,
        status=rejected.status,
        message=rejected.message,
        reviewed_by=rejected.reviewed_by,
        reviewed_at=rejected.reviewed_at,
        rejection_reason=rejected.rejection_reason,
        created_at=rejected.created_at,
        updated_at=rejected.updated_at,
        applicant_name=applicant.full_name if applicant else None,
        applicant_email=applicant.email if applicant else None,
        notification_delivery=delivery,
    )


@admin_router.post(
    "/organizations/{organization_id}/invitations",
    response_model=OrganizationInvitationResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_organization_invitation(
    organization_id: uuid.UUID,
    data: OrganizationInvitationCreate,
    admin: Annotated[User, Depends(get_active_user)],
    db: Annotated[Session, Depends(get_db)],
) -> OrganizationInvitationResponse:
    organization = get_organization_or_404(db, organization_id)
    issued = issue_organization_invitation(
        db,
        organization,
        admin,
        data.email,
        data.expires_in_days,
    )
    invitation = issued.invitation
    return OrganizationInvitationResponse(
        id=invitation.id,
        organization_id=invitation.organization_id,
        email=invitation.email,
        status=invitation.status,
        expires_at=invitation.expires_at,
        invited_by=invitation.invited_by,
        accepted_by=invitation.accepted_by,
        accepted_at=invitation.accepted_at,
        revoked_at=invitation.revoked_at,
        created_at=invitation.created_at,
        invitation_url=issued.invitation_url,
        notification_delivery=issued.notification_delivery,
    )


@admin_router.get(
    "/organizations/{organization_id}/invitations",
    response_model=OrganizationInvitationList,
)
def get_organization_invitations(
    organization_id: uuid.UUID,
    admin: Annotated[User, Depends(get_active_user)],
    db: Annotated[Session, Depends(get_db)],
) -> OrganizationInvitationList:
    organization = get_organization_or_404(db, organization_id)
    invitations = list_organization_invitations(db, organization, admin)
    return OrganizationInvitationList(
        items=[
            OrganizationInvitationResponse(
                id=invitation.id,
                organization_id=invitation.organization_id,
                email=invitation.email,
                status=invitation.status,
                expires_at=invitation.expires_at,
                invited_by=invitation.invited_by,
                accepted_by=invitation.accepted_by,
                accepted_at=invitation.accepted_at,
                revoked_at=invitation.revoked_at,
                created_at=invitation.created_at,
                notification_delivery=delivery,
            )
            for invitation, delivery in invitations
        ]
    )


@admin_router.post(
    "/organizations/{organization_id}/invitations/{invitation_id}/revoke",
    response_model=OrganizationInvitationResponse,
)
def revoke_invitation(
    organization_id: uuid.UUID,
    invitation_id: uuid.UUID,
    admin: Annotated[User, Depends(get_active_user)],
    db: Annotated[Session, Depends(get_db)],
) -> OrganizationInvitationResponse:
    organization = get_organization_or_404(db, organization_id)
    invitation = revoke_organization_invitation(
        db, organization, invitation_id, admin
    )
    delivery = send_email(
        invitation.email,
        f"Invitation to {organization.name} revoked",
        f"The invitation to join {organization.name} has been revoked.",
    )
    return OrganizationInvitationResponse(
        id=invitation.id,
        organization_id=invitation.organization_id,
        email=invitation.email,
        status=invitation.status,
        expires_at=invitation.expires_at,
        invited_by=invitation.invited_by,
        accepted_by=invitation.accepted_by,
        accepted_at=invitation.accepted_at,
        revoked_at=invitation.revoked_at,
        created_at=invitation.created_at,
        notification_delivery=delivery,
    )


@admin_router.get(
    "/organizations/{organization_id}/membership-verifications",
    response_model=MembershipVerificationList,
)
def get_membership_verifications(
    organization_id: uuid.UUID,
    admin: Annotated[User, Depends(get_active_user)],
    db: Annotated[Session, Depends(get_db)],
    verification_status: Annotated[
        MembershipVerificationStatus | None,
        Query(alias="status"),
    ] = MembershipVerificationStatus.PENDING,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
) -> MembershipVerificationList:
    organization = get_organization_or_404(db, organization_id)
    verifications = list_membership_verifications(
        db,
        organization,
        admin,
        status_filter=verification_status,
        offset=offset,
        limit=limit,
    )
    return MembershipVerificationList(
        items=[
            MembershipVerificationResponse(
                id=verification.id,
                organization_id=verification.organization_id,
                user_id=verification.user_id,
                membership_request_id=verification.membership_request_id,
                invitation_id=verification.invitation_id,
                verification_mode=verification.verification_mode,
                status=verification.status,
                membership_requires_approval=verification.membership_requires_approval,
                submission_note=verification.submission_note,
                rejection_reason=verification.rejection_reason,
                reviewed_by=verification.reviewed_by,
                reviewed_at=verification.reviewed_at,
                created_at=verification.created_at,
                applicant_name=applicant.full_name if applicant else None,
                applicant_email=applicant.email if applicant else None,
            )
            for verification, applicant in verifications
        ]
    )


@admin_router.post(
    "/organizations/{organization_id}/membership-verifications/{verification_id}/approve",
    response_model=MembershipVerificationResponse,
)
def approve_membership_verification(
    organization_id: uuid.UUID,
    verification_id: uuid.UUID,
    admin: Annotated[User, Depends(get_active_user)],
    db: Annotated[Session, Depends(get_db)],
) -> MembershipVerificationResponse:
    organization = get_organization_or_404(db, organization_id)
    decision = review_membership_verification(
        db,
        organization,
        verification_id,
        admin,
        approved=True,
    )
    verification = decision.verification
    applicant = db.get(User, verification.user_id)
    delivery = (
        send_email(
            applicant.email,
            f"Membership verification completed for {organization.name}",
            (
                f"Your verification for {organization.name} was approved. "
                "Your membership request is awaiting administrator approval."
                if verification.membership_requires_approval
                else f"Your membership in {organization.name} is now active."
            ),
        )
        if applicant
        else None
    )
    return MembershipVerificationResponse(
        id=verification.id,
        organization_id=verification.organization_id,
        user_id=verification.user_id,
        membership_request_id=verification.membership_request_id,
        invitation_id=verification.invitation_id,
        verification_mode=verification.verification_mode,
        status=verification.status,
        membership_requires_approval=verification.membership_requires_approval,
        submission_note=verification.submission_note,
        rejection_reason=verification.rejection_reason,
        reviewed_by=verification.reviewed_by,
        reviewed_at=verification.reviewed_at,
        created_at=verification.created_at,
        applicant_name=applicant.full_name if applicant else None,
        applicant_email=applicant.email if applicant else None,
        notification_delivery=delivery,
    )


@admin_router.post(
    "/organizations/{organization_id}/membership-verifications/{verification_id}/reject",
    response_model=MembershipVerificationResponse,
)
def reject_membership_verification(
    organization_id: uuid.UUID,
    verification_id: uuid.UUID,
    data: MembershipVerificationReject,
    admin: Annotated[User, Depends(get_active_user)],
    db: Annotated[Session, Depends(get_db)],
) -> MembershipVerificationResponse:
    organization = get_organization_or_404(db, organization_id)
    decision = review_membership_verification(
        db,
        organization,
        verification_id,
        admin,
        approved=False,
        reason=data.reason,
    )
    verification = decision.verification
    applicant = db.get(User, verification.user_id)
    delivery = (
        send_email(
            applicant.email,
            f"Membership verification update for {organization.name}",
            f"Your verification for {organization.name} was not approved.\n"
            f"Reason: {data.reason}",
        )
        if applicant
        else None
    )
    return MembershipVerificationResponse(
        id=verification.id,
        organization_id=verification.organization_id,
        user_id=verification.user_id,
        membership_request_id=verification.membership_request_id,
        invitation_id=verification.invitation_id,
        verification_mode=verification.verification_mode,
        status=verification.status,
        membership_requires_approval=verification.membership_requires_approval,
        submission_note=verification.submission_note,
        rejection_reason=verification.rejection_reason,
        reviewed_by=verification.reviewed_by,
        reviewed_at=verification.reviewed_at,
        created_at=verification.created_at,
        applicant_name=applicant.full_name if applicant else None,
        applicant_email=applicant.email if applicant else None,
        notification_delivery=delivery,
    )


@admin_router.get(
    "/organization-requests",
    response_model=OrganizationRequestList,
)
def get_organization_requests(
    admin: Annotated[User, Depends(get_platform_super_admin)],
    db: Annotated[Session, Depends(get_db)],
    request_status: Annotated[
        OrganizationRequestStatus | None,
        Query(alias="status"),
    ] = OrganizationRequestStatus.PENDING_APPROVAL,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
) -> OrganizationRequestList:
    return OrganizationRequestList(
        items=list_requests(
            db,
            status_filter=request_status,
            offset=offset,
            limit=limit,
        )
    )


@admin_router.get(
    "/organization-requests/{request_id}",
    response_model=OrganizationRequestResponse,
)
def get_organization_request_details(
    request_id: uuid.UUID,
    admin: Annotated[User, Depends(get_platform_super_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> OrganizationRequestResponse:
    return get_request_or_404(db, request_id)


@admin_router.post(
    "/organization-requests/{request_id}/approve",
    response_model=OrganizationResponse,
)
def approve_request(
    request_id: uuid.UUID,
    admin: Annotated[User, Depends(get_platform_super_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> OrganizationResponse:
    request = get_request_or_404(db, request_id, for_update=True)
    organization = approve_organization_request(db, request, admin)
    if request.requested_by:
        try:
            publish(db, event_id=f"organisation-request:{request.id}:approved", event_key="organisation.request.approved", recipient_user_id=request.requested_by, payload={"organisation_name": organization.name}, resource_type="organization", resource_id=str(organization.id))
            db.commit()
        except Exception:
            db.rollback()
    return organization


@admin_router.post(
    "/organization-requests/{request_id}/reject",
    response_model=OrganizationRequestResponse,
)
def reject_request(
    request_id: uuid.UUID,
    rejection: OrganizationReject,
    admin: Annotated[User, Depends(get_platform_super_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> OrganizationRequestResponse:
    request = get_request_or_404(db, request_id, for_update=True)
    rejected = reject_organization_request(db, request, admin, rejection)
    if rejected.requested_by:
        try:
            publish(db, event_id=f"organisation-request:{rejected.id}:rejected", event_key="organisation.request.rejected", recipient_user_id=rejected.requested_by, payload={"organisation_name": rejected.name, "rejection_reason": rejected.rejection_reason or "No reason provided"}, resource_type="organization_request", resource_id=str(rejected.id))
            db.commit()
        except Exception:
            db.rollback()
    return rejected


@admin_router.post(
    "/organizations",
    response_model=OrganizationResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_organization(
    data: OrganizationDirectCreate,
    admin: Annotated[User, Depends(get_platform_super_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> OrganizationResponse:
    return create_organization_directly(db, admin, data)


@admin_router.put(
    "/organizations/{organization_id}/management",
    response_model=OrganizationManagementAssignmentResponse,
)
def update_organization_management(
    organization_id: uuid.UUID,
    update: OrganizationManagementUpdate,
    admin: Annotated[User, Depends(get_platform_super_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> OrganizationManagementAssignmentResponse:
    organization = get_organization_or_404(db, organization_id)
    if organization.status != OrganizationStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only active organisations can have their initial management changed.",
        )
    assignment = update_initial_management(db, organization, admin, update)
    return OrganizationManagementAssignmentResponse(
        organization_id=assignment.organization_id,
        user_id=assignment.user_id,
        role=assignment.role,
        management_mode=update.management_mode,
    )


@admin_router.post(
    "/organizations/{organization_id}/suspend",
    response_model=OrganizationStatusResponse,
)
def suspend_organization(
    organization_id: uuid.UUID,
    admin: Annotated[User, Depends(get_platform_super_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> OrganizationStatusResponse:
    organization = get_organization_or_404(db, organization_id)
    organization = change_organization_status(
        db, organization, admin, OrganizationStatus.SUSPENDED
    )
    return OrganizationStatusResponse(id=organization.id, status=organization.status)


@admin_router.post(
    "/organizations/{organization_id}/restore",
    response_model=OrganizationStatusResponse,
)
def restore_organization(
    organization_id: uuid.UUID,
    admin: Annotated[User, Depends(get_platform_super_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> OrganizationStatusResponse:
    organization = get_organization_or_404(db, organization_id)
    organization = change_organization_status(
        db, organization, admin, OrganizationStatus.ACTIVE
    )
    return OrganizationStatusResponse(id=organization.id, status=organization.status)
