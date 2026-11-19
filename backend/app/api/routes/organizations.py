import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_active_user, get_platform_super_admin
from app.database.session import get_db
from app.models.organization import (
    MembershipRequestStatus,
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
    MembershipRequestCreate,
    MembershipRequestReject,
    MembershipRequestList,
    MembershipRequestResponse,
    MembershipResponse,
    MembershipList,
    MembershipStatusResponse,
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
)
from app.services.memberships import (
    approve_membership_request,
    get_membership_status,
    list_membership_requests,
    list_my_memberships,
    reject_membership_request,
    require_organization_administrator,
    submit_membership_request,
)

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
    return submit_membership_request(db, organization, user, data.message)


@organization_router.get("/{organization_id}", response_model=OrganizationResponse)
def get_organization_details(
    organization_id: uuid.UUID,
    user: Annotated[User, Depends(get_active_user)],
    db: Annotated[Session, Depends(get_db)],
) -> OrganizationResponse:
    organization = get_organization_or_404(db, organization_id)
    if organization.status == OrganizationStatus.ACTIVE:
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
    return approve_membership_request(db, organization, request, admin)


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
    return reject_membership_request(db, organization, request, admin, data.reason)


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
    return approve_organization_request(db, request, admin)


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
    return reject_organization_request(db, request, admin, rejection)


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
