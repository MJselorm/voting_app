import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth.dependencies import get_platform_super_admin
from app.auth.permissions import AssignmentStatus, OrganizationRole, PlatformRole
from app.database.session import get_db
from app.models.organization import (
    Organization,
    OrganizationAuditLog,
    OrganizationRequest,
    OrganizationRequestStatus,
    OrganizationStatus,
)
from app.models.rbac import (
    OrganizationRoleAssignment,
    PlatformRoleAssignment,
    PlatformSetting,
)
from app.models.user import User
from app.schemas.rbac import (
    AuditLogList,
    AuditLogResponse,
    OrganizationRoleAssignmentCreate,
    PlatformOverviewResponse,
    PlatformSettingList,
    PlatformSettingResponse,
    PlatformSettingUpdate,
    PlatformUserList,
    PlatformUserSummary,
    RoleAssignmentResponse,
)


router = APIRouter(prefix="/v1/admin", tags=["rbac"])


@router.get("/overview", response_model=PlatformOverviewResponse)
def get_platform_overview(
    admin: User = Depends(get_platform_super_admin),
    db: Session = Depends(get_db),
) -> PlatformOverviewResponse:
    total_users = db.scalar(select(func.count()).select_from(User)) or 0
    total_organizations = db.scalar(select(func.count()).select_from(Organization)) or 0
    active_organizations = db.scalar(
        select(func.count()).select_from(Organization).where(Organization.status == OrganizationStatus.ACTIVE)
    ) or 0
    pending_requests = db.scalar(
        select(func.count()).select_from(OrganizationRequest).where(
            OrganizationRequest.status == OrganizationRequestStatus.PENDING_APPROVAL
        )
    ) or 0
    suspended_organizations = db.scalar(
        select(func.count()).select_from(Organization).where(
            Organization.status == OrganizationStatus.SUSPENDED
        )
    ) or 0
    return PlatformOverviewResponse(
        total_users=total_users,
        total_organizations=total_organizations,
        active_organizations=active_organizations,
        pending_requests=pending_requests,
        suspended_organizations=suspended_organizations,
    )


@router.get("/users", response_model=PlatformUserList)
def list_platform_users(
    admin: User = Depends(get_platform_super_admin),
    db: Session = Depends(get_db),
    search: str | None = Query(default=None, max_length=100),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=100),
) -> PlatformUserList:
    statement = select(User)
    statement = statement.where(User.is_active.is_(True))
    if search:
        pattern = f"%{search.strip().lower()}%"
        statement = statement.where(
            (User.full_name.ilike(pattern)) | (User.email.ilike(pattern))
        )
    users = db.scalars(statement.order_by(User.created_at.desc()).offset(offset).limit(limit)).all()
    return PlatformUserList(items=[
        PlatformUserSummary(
            id=user.id,
            full_name=user.full_name,
            email=user.email,
            is_active=user.is_active,
            is_platform_super_admin=user.is_platform_super_admin,
            created_at=user.created_at,
        )
        for user in users
    ])


@router.get("/audit", response_model=AuditLogList)
def list_platform_audit(
    admin: User = Depends(get_platform_super_admin),
    db: Session = Depends(get_db),
    action: str | None = Query(default=None, max_length=60),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=100),
) -> AuditLogList:
    statement = select(OrganizationAuditLog)
    if action:
        statement = statement.where(OrganizationAuditLog.action == action)
    logs = db.scalars(
        statement.order_by(OrganizationAuditLog.created_at.desc()).offset(offset).limit(limit)
    ).all()
    return AuditLogList(items=[
        AuditLogResponse(
            id=log.id,
            actor_user_id=log.actor_user_id,
            action=log.action,
            organization_id=log.organization_id,
            request_id=log.request_id,
            details=log.details,
            created_at=log.created_at,
        )
        for log in logs
    ])


@router.get("/users/{user_id}/roles", response_model=list[RoleAssignmentResponse])
def get_user_roles(
    user_id: uuid.UUID,
    admin: User = Depends(get_platform_super_admin),
    db: Session = Depends(get_db),
) -> list[RoleAssignmentResponse]:
    target = db.get(User, user_id)
    if target is None:
        raise HTTPException(status_code=404, detail="User not found.")
    platform = db.scalars(
        select(PlatformRoleAssignment).where(
            PlatformRoleAssignment.user_id == user_id,
            PlatformRoleAssignment.status == AssignmentStatus.ACTIVE,
        )
    ).all()
    organization = db.scalars(
        select(OrganizationRoleAssignment).where(
            OrganizationRoleAssignment.user_id == user_id,
            OrganizationRoleAssignment.status == AssignmentStatus.ACTIVE,
        )
    ).all()
    return [
        *[
            RoleAssignmentResponse(
                id=item.id,
                user_id=item.user_id,
                role=item.role.value,
                status=item.status,
                assigned_by=item.assigned_by,
                assigned_at=item.assigned_at,
                revoked_at=item.revoked_at,
            )
            for item in platform
        ],
        *[
            RoleAssignmentResponse(
                id=item.id,
                user_id=item.user_id,
                role=item.role.value,
                status=item.status,
                assigned_by=item.assigned_by,
                assigned_at=item.assigned_at,
                revoked_at=item.revoked_at,
                organization_id=item.organization_id,
            )
            for item in organization
        ],
    ]


@router.post("/organizations/{organization_id}/roles", response_model=RoleAssignmentResponse)
def assign_organization_role(
    organization_id: uuid.UUID,
    data: OrganizationRoleAssignmentCreate,
    admin: User = Depends(get_platform_super_admin),
    db: Session = Depends(get_db),
) -> RoleAssignmentResponse:
    organization = db.get(Organization, organization_id)
    target = db.get(User, data.user_id)
    if organization is None or target is None or not target.is_active:
        raise HTTPException(status_code=404, detail="Organisation or active user not found.")
    if data.role == OrganizationRole.ORGANISATION_OWNER:
        raise HTTPException(status_code=422, detail="Owner assignment must use the organisation handover workflow.")
    existing = db.scalar(
        select(OrganizationRoleAssignment).where(
            OrganizationRoleAssignment.organization_id == organization_id,
            OrganizationRoleAssignment.user_id == data.user_id,
            OrganizationRoleAssignment.role == data.role,
            OrganizationRoleAssignment.status == AssignmentStatus.ACTIVE,
        )
    )
    if existing:
        raise HTTPException(status_code=409, detail="This role is already assigned.")
    assignment = OrganizationRoleAssignment(
        organization_id=organization_id,
        user_id=data.user_id,
        role=data.role,
        status=AssignmentStatus.ACTIVE,
        assigned_by=admin.id,
    )
    db.add(assignment)
    db.flush()
    db.commit()
    db.refresh(assignment)
    db.add(OrganizationAuditLog(
        organization_id=organization_id,
        actor_user_id=admin.id,
        action="ORGANIZATION_ROLE_ASSIGNED",
        details={"target_user_id": str(data.user_id), "role": data.role.value},
    ))
    db.commit()
    return RoleAssignmentResponse(
        id=assignment.id,
        user_id=assignment.user_id,
        role=assignment.role.value,
        status=assignment.status,
        assigned_by=assignment.assigned_by,
        assigned_at=assignment.assigned_at,
        revoked_at=assignment.revoked_at,
        organization_id=assignment.organization_id,
    )


@router.post("/users/{user_id}/platform-role", response_model=RoleAssignmentResponse)
def assign_platform_super_admin(
    user_id: uuid.UUID,
    admin: User = Depends(get_platform_super_admin),
    db: Session = Depends(get_db),
) -> RoleAssignmentResponse:
    target = db.get(User, user_id)
    if target is None or not target.is_active:
        raise HTTPException(status_code=404, detail="Active user not found.")
    existing = db.scalar(
        select(PlatformRoleAssignment).where(
            PlatformRoleAssignment.user_id == user_id,
            PlatformRoleAssignment.status == AssignmentStatus.ACTIVE,
        )
    )
    if existing:
        raise HTTPException(status_code=409, detail="The user already has the Platform Super Admin role.")
    target.is_platform_super_admin = True
    assignment = PlatformRoleAssignment(
        user_id=user_id,
        role=PlatformRole.PLATFORM_SUPER_ADMIN,
        status=AssignmentStatus.ACTIVE,
        assigned_by=admin.id,
    )
    db.add(assignment)
    db.add(OrganizationAuditLog(
        actor_user_id=admin.id,
        action="PLATFORM_SUPER_ADMIN_ASSIGNED",
        details={"target_user_id": str(user_id)},
    ))
    db.commit()
    db.refresh(assignment)
    return RoleAssignmentResponse(
        id=assignment.id,
        user_id=assignment.user_id,
        role=assignment.role.value,
        status=assignment.status,
        assigned_by=assignment.assigned_by,
        assigned_at=assignment.assigned_at,
        revoked_at=assignment.revoked_at,
    )


@router.delete("/role-assignment/{assignment_id}", status_code=204)
def revoke_role_assignment(
    assignment_id: uuid.UUID,
    admin: User = Depends(get_platform_super_admin),
    db: Session = Depends(get_db),
) -> None:
    assignment = db.get(OrganizationRoleAssignment, assignment_id)
    if assignment is None:
        platform_assignment = db.get(PlatformRoleAssignment, assignment_id)
        if platform_assignment is None:
            raise HTTPException(status_code=404, detail="Role assignment not found.")
        if platform_assignment.status != AssignmentStatus.ACTIVE:
            raise HTTPException(status_code=409, detail="Role assignment is already revoked.")
        active_admin_count = db.scalar(
            select(func.count()).select_from(User).where(
                User.is_platform_super_admin.is_(True),
                User.is_active.is_(True),
            )
        ) or 0
        if active_admin_count <= 1 and platform_assignment.user_id == admin.id:
            raise HTTPException(status_code=409, detail="The last active Platform Super Admin cannot be revoked.")
        platform_assignment.status = AssignmentStatus.REVOKED
        platform_assignment.revoked_at = datetime.now(timezone.utc)
        target = db.get(User, platform_assignment.user_id)
        if target:
            target.is_platform_super_admin = False
        db.commit()
        return
    if assignment.status != AssignmentStatus.ACTIVE:
        raise HTTPException(status_code=409, detail="Role assignment is already revoked.")
    assignment.status = AssignmentStatus.REVOKED
    assignment.revoked_at = datetime.now(timezone.utc)
    db.commit()


@router.get("/settings", response_model=PlatformSettingList)
def list_platform_settings(
    admin: User = Depends(get_platform_super_admin),
    db: Session = Depends(get_db),
) -> PlatformSettingList:
    settings = db.scalars(select(PlatformSetting).order_by(PlatformSetting.key)).all()
    return PlatformSettingList(items=[
        PlatformSettingResponse(
            key=item.key,
            value=item.value,
            description=item.description,
            updated_at=item.updated_at,
        )
        for item in settings
    ])


@router.put("/settings/{key}", response_model=PlatformSettingResponse)
def update_platform_setting(
    key: str,
    data: PlatformSettingUpdate,
    admin: User = Depends(get_platform_super_admin),
    db: Session = Depends(get_db),
) -> PlatformSettingResponse:
    if len(key) > 100:
        raise HTTPException(status_code=422, detail="Setting key is too long.")
    setting = db.get(PlatformSetting, key)
    if setting is None:
        setting = PlatformSetting(key=key, value=data.value, description=data.description)
        db.add(setting)
    else:
        setting.value = data.value
        setting.description = data.description
    setting.updated_by = admin.id
    db.commit()
    db.refresh(setting)
    return PlatformSettingResponse(
        key=setting.key,
        value=setting.value,
        description=setting.description,
        updated_at=setting.updated_at,
    )
