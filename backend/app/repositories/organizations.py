import uuid

from sqlalchemy import Select, exists, select
from sqlalchemy.orm import Session

from app.models.organization import (
    Organization,
    OrganizationManagementAssignment,
    OrganizationRequest,
    OrganizationRequestStatus,
    OrganizationStatus,
)


def get_organization(db: Session, organization_id: uuid.UUID) -> Organization | None:
    return db.get(Organization, organization_id)


def get_organization_request(
    db: Session,
    request_id: uuid.UUID,
    *,
    for_update: bool = False,
) -> OrganizationRequest | None:
    statement = select(OrganizationRequest).where(
        OrganizationRequest.id == request_id
    )
    if for_update:
        statement = statement.with_for_update()
    return db.scalar(statement)


def get_management_assignment(
    db: Session,
    organization_id: uuid.UUID,
    user_id: uuid.UUID,
) -> OrganizationManagementAssignment | None:
    return db.scalar(
        select(OrganizationManagementAssignment).where(
            OrganizationManagementAssignment.organization_id == organization_id,
            OrganizationManagementAssignment.user_id == user_id,
        )
    )


def list_organization_requests(
    db: Session,
    *,
    status_filter: OrganizationRequestStatus | None,
    requester_id: uuid.UUID | None,
    offset: int,
    limit: int,
) -> list[OrganizationRequest]:
    statement: Select[tuple[OrganizationRequest]] = select(OrganizationRequest)
    if status_filter is not None:
        statement = statement.where(OrganizationRequest.status == status_filter)
    if requester_id is not None:
        statement = statement.where(
            OrganizationRequest.requested_by == requester_id
        )
    return list(
        db.scalars(
            statement.order_by(
                OrganizationRequest.created_at.desc(),
                OrganizationRequest.id,
            )
            .offset(offset)
            .limit(limit)
        )
    )


def list_organizations(
    db: Session,
    *,
    status_filter: OrganizationStatus | None,
    public_only: bool = False,
    offset: int,
    limit: int,
) -> list[Organization]:
    statement: Select[tuple[Organization]] = select(Organization)
    if status_filter is not None:
        statement = statement.where(Organization.status == status_filter)
    if public_only:
        statement = statement.where(Organization.is_public_profile.is_(True))
    return list(
        db.scalars(
            statement.order_by(Organization.created_at.desc(), Organization.id)
            .offset(offset)
            .limit(limit)
        )
    )


def list_user_organizations(
    db: Session,
    *,
    user_id: uuid.UUID,
    offset: int,
    limit: int,
) -> list[Organization]:
    assignment_exists = exists(
        select(OrganizationManagementAssignment.id).where(
            OrganizationManagementAssignment.organization_id == Organization.id,
            OrganizationManagementAssignment.user_id == user_id,
        )
    )
    statement = select(Organization).where(
        (Organization.created_by == user_id) | assignment_exists
    )
    return list(
        db.scalars(
            statement.order_by(Organization.created_at.desc(), Organization.id)
            .offset(offset)
            .limit(limit)
        )
    )
