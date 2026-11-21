import re
import unicodedata
import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.organization import (
    Organization,
    OrganizationAuditLog,
    OrganizationManagementAssignment,
    OrganizationManagementMode,
    OrganizationManagementRole,
    OrganizationRequest,
    OrganizationRequestStatus,
    OrganizationStatus,
)
from app.models.user import User
from app.auth.permissions import AssignmentStatus, OrganizationRole
from app.models.rbac import OrganizationRoleAssignment
from app.repositories.organizations import (
    get_management_assignment,
    get_organization,
    get_organization_request,
    list_organizations,
    list_organization_requests,
    list_user_organizations,
)
from app.schemas.organization import (
    OrganizationDirectCreate,
    OrganizationManagementUpdate,
    OrganizationReject,
    OrganizationRequestCreate,
    OrganizationProfileUpdate,
)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _slug_for(name: str) -> str:
    ascii_name = (
        unicodedata.normalize("NFKD", name)
        .encode("ascii", "ignore")
        .decode("ascii")
        .lower()
    )
    slug = re.sub(r"[^a-z0-9]+", "-", ascii_name).strip("-")
    if not slug:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="The organisation name cannot be converted into a valid slug.",
        )
    return slug[:120].rstrip("-")


def _record_audit(
    db: Session,
    *,
    actor: User,
    action: str,
    organization: Organization | None = None,
    request: OrganizationRequest | None = None,
    details: dict[str, str | None] | None = None,
) -> None:
    db.add(
        OrganizationAuditLog(
            actor_user_id=actor.id,
            organization_id=organization.id if organization else None,
            request_id=request.id if request else None,
            action=action,
            details=details or {},
        )
    )


def _commit(db: Session) -> None:
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An organisation with this slug or management assignment already exists.",
        ) from error


def update_organization_profile(db: Session, organization: Organization, actor: User, data: OrganizationProfileUpdate) -> Organization:
    if not is_organization_manager(db, organization.id, actor.id) and not actor.is_platform_super_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organisation management permission is required.")
    for field in ("name", "description", "organization_type", "logo_url", "contact_email", "contact_phone", "website", "country", "is_public_profile"):
        setattr(organization, field, getattr(data, field))
    _record_audit(db, actor=actor, action="ORGANIZATION_PROFILE_UPDATED", organization=organization, details={"is_public_profile": str(data.is_public_profile)})
    _commit(db); db.refresh(organization)
    return organization


def _flush(db: Session) -> None:
    try:
        db.flush()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An organisation with this slug or management assignment already exists.",
        ) from error


def submit_organization_request(
    db: Session,
    requester: User,
    request_data: OrganizationRequestCreate,
) -> OrganizationRequest:
    request = OrganizationRequest(
        name=request_data.name,
        organization_type=request_data.organization_type,
        description=request_data.description,
        logo_url=request_data.logo_url,
        contact_email=request_data.contact_email,
        contact_phone=request_data.contact_phone,
        website=request_data.website,
        country=request_data.country,
        supporting_information=request_data.supporting_information,
        status=OrganizationRequestStatus.PENDING_APPROVAL,
        requested_by=requester.id,
    )
    db.add(request)
    _flush(db)
    _record_audit(
        db,
        actor=requester,
        action="ORGANIZATION_REQUEST_SUBMITTED",
        request=request,
    )
    _commit(db)
    db.refresh(request)
    return request


def get_request_or_404(
    db: Session,
    request_id: uuid.UUID,
    *,
    for_update: bool = False,
) -> OrganizationRequest:
    request = get_organization_request(db, request_id, for_update=for_update)
    if request is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organisation request was not found.",
        )
    return request


def get_organization_or_404(db: Session, organization_id: uuid.UUID) -> Organization:
    organization = get_organization(db, organization_id)
    if organization is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organisation was not found.",
        )
    return organization


def list_requests(
    db: Session,
    *,
    status_filter: OrganizationRequestStatus | None = None,
    requester_id: uuid.UUID | None = None,
    offset: int = 0,
    limit: int = 50,
) -> list[OrganizationRequest]:
    return list_organization_requests(
        db,
        status_filter=status_filter,
        requester_id=requester_id,
        offset=offset,
        limit=limit,
    )


def list_all_organizations(
    db: Session,
    *,
    status_filter: OrganizationStatus | None = None,
    offset: int = 0,
    limit: int = 50,
) -> list[Organization]:
    return list_organizations(
        db,
        status_filter=status_filter,
        offset=offset,
        limit=limit,
    )


def list_discoverable_organizations(
    db: Session,
    *,
    organization_type: str | None = None,
    offset: int = 0,
    limit: int = 50,
) -> list[Organization]:
    organizations = list_organizations(
        db,
        status_filter=OrganizationStatus.ACTIVE,
        public_only=True,
        offset=offset,
        limit=limit,
    )
    if organization_type is None:
        return organizations
    return [item for item in organizations if item.organization_type.value == organization_type]


def list_my_organizations(
    db: Session,
    *,
    user_id: uuid.UUID,
    offset: int = 0,
    limit: int = 50,
) -> list[Organization]:
    return list_user_organizations(
        db,
        user_id=user_id,
        offset=offset,
        limit=limit,
    )


def approve_organization_request(
    db: Session,
    request: OrganizationRequest,
    admin: User,
) -> Organization:
    if request.status != OrganizationRequestStatus.PENDING_APPROVAL:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only pending organisation requests can be approved.",
        )
    if request.requested_by is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The requester account no longer exists; this request cannot be approved.",
        )
    requester = db.get(User, request.requested_by)
    if requester is None or not requester.is_active:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The requester account is no longer active; this request cannot be approved.",
        )

    organization = Organization(
        name=request.name,
        slug=_slug_for(request.name),
        description=request.description,
        organization_type=request.organization_type,
        contact_email=request.contact_email,
        contact_phone=request.contact_phone,
        logo_url=request.logo_url,
        website=request.website,
        country=request.country,
        status=OrganizationStatus.ACTIVE,
        created_by=requester.id,
        approved_by=admin.id,
        approved_at=_now(),
    )
    db.add(organization)
    _flush(db)
    db.add(
        OrganizationManagementAssignment(
            organization_id=organization.id,
            user_id=requester.id,
            role=OrganizationManagementRole.OWNER,
            assigned_by=admin.id,
        )
    )
    _sync_organization_owner_role(db, organization, requester, admin)
    request.status = OrganizationRequestStatus.APPROVED
    request.reviewed_by = admin.id
    request.reviewed_at = _now()
    request.organization_id = organization.id
    _record_audit(
        db,
        actor=admin,
        action="ORGANIZATION_REQUEST_APPROVED",
        organization=organization,
        request=request,
        details={"owner_user_id": str(requester.id)},
    )
    _record_audit(
        db,
        actor=admin,
        action="ORGANIZATION_MANAGEMENT_ASSIGNED",
        organization=organization,
        request=request,
        details={
            "user_id": str(requester.id),
            "role": OrganizationManagementRole.OWNER.value,
        },
    )
    _commit(db)
    db.refresh(organization)
    return organization


def reject_organization_request(
    db: Session,
    request: OrganizationRequest,
    admin: User,
    rejection: OrganizationReject,
) -> OrganizationRequest:
    if request.status != OrganizationRequestStatus.PENDING_APPROVAL:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only pending organisation requests can be rejected.",
        )
    request.status = OrganizationRequestStatus.REJECTED
    request.rejection_reason = rejection.reason
    request.reviewed_by = admin.id
    request.reviewed_at = _now()
    _record_audit(
        db,
        actor=admin,
        action="ORGANIZATION_REQUEST_REJECTED",
        request=request,
        details={"reason": rejection.reason},
    )
    _commit(db)
    db.refresh(request)
    return request


def _get_manager(
    db: Session,
    manager_id: uuid.UUID,
) -> User:
    manager = db.get(User, manager_id)
    if manager is None or not manager.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="The designated organisation manager does not exist or is inactive.",
        )
    return manager


def _select_initial_manager(
    db: Session,
    actor: User,
    mode: OrganizationManagementMode,
    manager_user_id: uuid.UUID | None,
) -> User:
    if mode == OrganizationManagementMode.RETAIN_PLATFORM_MANAGEMENT:
        if manager_user_id is not None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Do not provide manager_user_id when retaining platform management.",
            )
        return actor
    if manager_user_id is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="manager_user_id is required when assigning organisation management.",
        )
    return _get_manager(db, manager_user_id)


def _create_management_assignment(
    db: Session,
    organization: Organization,
    manager: User,
    assigned_by: User,
) -> None:
    db.add(
        OrganizationManagementAssignment(
            organization_id=organization.id,
            user_id=manager.id,
            role=OrganizationManagementRole.OWNER,
            assigned_by=assigned_by.id,
        )
    )


def _sync_organization_owner_role(
    db: Session,
    organization: Organization,
    owner: User,
    assigned_by: User,
) -> None:
    active_assignments = list(
        db.scalars(
            select(OrganizationRoleAssignment).where(
                OrganizationRoleAssignment.organization_id == organization.id,
                OrganizationRoleAssignment.status == AssignmentStatus.ACTIVE,
                OrganizationRoleAssignment.role == OrganizationRole.ORGANISATION_OWNER,
            )
        )
    )
    for assignment in active_assignments:
        if assignment.user_id != owner.id:
            assignment.status = AssignmentStatus.REVOKED
            assignment.revoked_at = _now()

    target = db.scalar(
        select(OrganizationRoleAssignment).where(
            OrganizationRoleAssignment.organization_id == organization.id,
            OrganizationRoleAssignment.user_id == owner.id,
            OrganizationRoleAssignment.role == OrganizationRole.ORGANISATION_OWNER,
        )
    )
    if target is None:
        db.add(
            OrganizationRoleAssignment(
                organization_id=organization.id,
                user_id=owner.id,
                role=OrganizationRole.ORGANISATION_OWNER,
                status=AssignmentStatus.ACTIVE,
                assigned_by=assigned_by.id,
            )
        )
    else:
        target.status = AssignmentStatus.ACTIVE
        target.revoked_at = None
        target.assigned_by = assigned_by.id


def _revoke_organization_owner_roles(
    db: Session,
    organization: Organization,
    retained_owner_id: uuid.UUID,
) -> None:
    assignments = list(
        db.scalars(
            select(OrganizationRoleAssignment).where(
                OrganizationRoleAssignment.organization_id == organization.id,
                OrganizationRoleAssignment.status == AssignmentStatus.ACTIVE,
                OrganizationRoleAssignment.role == OrganizationRole.ORGANISATION_OWNER,
            )
        )
    )
    for assignment in assignments:
        if assignment.user_id == retained_owner_id:
            continue
        assignment.status = AssignmentStatus.REVOKED
        assignment.revoked_at = _now()


def create_organization_directly(
    db: Session,
    admin: User,
    data: OrganizationDirectCreate,
) -> Organization:
    manager = _select_initial_manager(
        db, admin, data.management_mode, data.manager_user_id
    )
    organization = Organization(
        name=data.name,
        slug=data.slug or _slug_for(data.name),
        description=data.description,
        organization_type=data.organization_type,
        logo_url=data.logo_url,
        contact_email=data.contact_email,
        contact_phone=data.contact_phone,
        website=data.website,
        country=data.country,
        status=OrganizationStatus.ACTIVE,
        created_by=admin.id,
        approved_by=admin.id,
        approved_at=_now(),
    )
    db.add(organization)
    _flush(db)
    _create_management_assignment(db, organization, manager, admin)
    _sync_organization_owner_role(db, organization, manager, admin)
    _record_audit(
        db,
        actor=admin,
        action="ORGANIZATION_CREATED_DIRECTLY",
        organization=organization,
        details={
            "management_mode": data.management_mode.value,
            "initial_manager_user_id": (
                str(manager.id)
                if data.management_mode == OrganizationManagementMode.ASSIGN_OWNER
                else None
            ),
            "owner_assignment_pending": (
                data.management_mode == OrganizationManagementMode.RETAIN_PLATFORM_MANAGEMENT
            ),
        },
    )
    _record_audit(
        db,
        actor=admin,
        action=(
            "ORGANIZATION_MANAGEMENT_RETAINED"
            if data.management_mode
            == OrganizationManagementMode.RETAIN_PLATFORM_MANAGEMENT
            else "ORGANIZATION_MANAGEMENT_HANDED_OVER"
        ),
        organization=organization,
        details={"user_id": str(manager.id)},
    )
    _commit(db)
    db.refresh(organization)
    return organization


def update_initial_management(
    db: Session,
    organization: Organization,
    admin: User,
    update: OrganizationManagementUpdate,
) -> OrganizationManagementAssignment:
    manager = _select_initial_manager(
        db, admin, update.management_mode, update.manager_user_id
    )

    owner_assignments = list(
        db.scalars(
            select(OrganizationManagementAssignment).where(
                OrganizationManagementAssignment.organization_id == organization.id,
                OrganizationManagementAssignment.role
                == OrganizationManagementRole.OWNER,
            )
        )
    )
    for assignment in owner_assignments:
        if assignment.user_id == admin.id and manager.id != admin.id:
            db.delete(assignment)
        elif assignment.user_id != manager.id:
            assignment.role = OrganizationManagementRole.ADMIN
    _flush(db)

    target_assignment = get_management_assignment(db, organization.id, manager.id)
    if target_assignment is None:
        target_assignment = OrganizationManagementAssignment(
            organization_id=organization.id,
            user_id=manager.id,
            role=OrganizationManagementRole.OWNER,
            assigned_by=admin.id,
        )
        db.add(target_assignment)
    else:
        target_assignment.role = OrganizationManagementRole.OWNER
        target_assignment.assigned_by = admin.id

    _sync_organization_owner_role(db, organization, manager, admin)

    action = (
        "ORGANIZATION_MANAGEMENT_RETAINED"
        if update.management_mode
        == OrganizationManagementMode.RETAIN_PLATFORM_MANAGEMENT
        else "ORGANIZATION_MANAGEMENT_HANDED_OVER"
    )
    _record_audit(
        db,
        actor=admin,
        action=action,
        organization=organization,
        details={"user_id": str(manager.id)},
    )
    _commit(db)
    db.refresh(target_assignment)
    return target_assignment


def change_organization_status(
    db: Session,
    organization: Organization,
    admin: User,
    target_status: OrganizationStatus,
) -> Organization:
    if target_status == OrganizationStatus.SUSPENDED:
        if organization.status != OrganizationStatus.ACTIVE:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Only active organisations can be suspended.",
            )
        action = "ORGANIZATION_SUSPENDED"
    else:
        if organization.status != OrganizationStatus.SUSPENDED:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Only suspended organisations can be restored.",
            )
        action = "ORGANIZATION_RESTORED"
    organization.status = target_status
    _record_audit(
        db,
        actor=admin,
        action=action,
        organization=organization,
    )
    _commit(db)
    db.refresh(organization)
    return organization


def is_organization_manager(
    db: Session,
    organization_id: uuid.UUID,
    user_id: uuid.UUID,
) -> bool:
    return get_management_assignment(db, organization_id, user_id) is not None
