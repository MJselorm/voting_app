import uuid
import time

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.auth.dependencies import get_firebase_claims
from app.database.session import get_db
from app.models.organization import (
    Organization,
    OrganizationAuditLog,
    OrganizationManagementAssignment,
    OrganizationManagementRole,
    OrganizationRequest,
    OrganizationRequestStatus,
    OrganizationMembership,
    OrganizationMembershipRequest,
    MembershipRequestStatus,
    MembershipStatus,
)
from app.auth.permissions import AssignmentStatus, OrganizationRole
from app.models.rbac import OrganizationRoleAssignment
from app.models.user import User
from tests.factories import VALID_CLAIMS


ORG_FIELDS = {
    "name": "North Coast University",
    "organization_type": "UNIVERSITY",
    "description": "A member university.",
    "contact_email": "contact@example.com",
    "website": "https://example.com",
    "country": "Ghana",
}


def use_identity(client: TestClient, claims: dict) -> None:
    client.app.dependency_overrides[get_firebase_claims] = lambda: dict(claims)


def sync_identity(client: TestClient, claims: dict) -> dict:
    use_identity(client, claims)
    response = client.post("/api/auth/sync")
    assert response.status_code == 200
    return response.json()


def promote_to_platform_admin(client: TestClient, claims: dict) -> dict:
    profile = sync_identity(client, claims)
    db_generator = client.app.dependency_overrides[get_db]()
    db = next(db_generator)
    user = db.get(User, uuid.UUID(profile["id"]))
    assert user is not None
    user.is_platform_super_admin = True
    db.commit()
    db.close()
    db_generator.close()
    return profile


def read_user(client: TestClient, user_id: str) -> User:
    db_generator = client.app.dependency_overrides[get_db]()
    db = next(db_generator)
    user = db.get(User, uuid.UUID(user_id))
    assert user is not None
    db.expunge(user)
    db.close()
    db_generator.close()
    return user


def read_db_rows(client: TestClient, statement):
    db_generator = client.app.dependency_overrides[get_db]()
    db = next(db_generator)
    rows = list(db.scalars(statement))
    db.close()
    db_generator.close()
    return rows


def admin_claims() -> dict:
    return {
        **VALID_CLAIMS,
        "uid": "platform-admin-firebase",
        "email": "platform-admin@example.com",
        "name": "Platform Administrator",
    }


def owner_claims() -> dict:
    return {
        **VALID_CLAIMS,
        "uid": "organization-owner-firebase",
        "email": "org-owner@example.com",
        "name": "Organisation Owner",
    }


def make_direct_organization(client: TestClient, **overrides) -> dict:
    payload = {
        **ORG_FIELDS,
        "management_mode": "RETAIN_PLATFORM_MANAGEMENT",
        **overrides,
    }
    return client.post("/api/v1/admin/organizations", json=payload)


def test_authenticated_user_submits_and_lists_own_request(client):
    sync_identity(client, VALID_CLAIMS)
    response = client.post(
        "/api/v1/organizations/requests",
        json={
            **ORG_FIELDS,
            "supporting_information": "Registration document reference.",
        },
    )

    assert response.status_code == 201
    submitted = response.json()
    assert submitted["status"] == "PENDING_APPROVAL"
    assert submitted["requested_by"]
    assert submitted["organization_id"] is None

    listed = client.get("/api/v1/organizations/requests/me")
    assert listed.status_code == 200
    assert [item["id"] for item in listed.json()["items"]] == [submitted["id"]]


def test_unauthenticated_user_cannot_submit_organization_request(client):
    client.app.dependency_overrides.pop(get_firebase_claims)

    response = client.post(
        "/api/v1/organizations/requests",
        json=ORG_FIELDS,
    )

    assert response.status_code == 401


def test_ordinary_user_cannot_review_or_create_organizations(client):
    sync_identity(client, VALID_CLAIMS)
    submitted = client.post(
        "/api/v1/organizations/requests",
        json=ORG_FIELDS,
    ).json()

    pending = client.get("/api/v1/admin/organization-requests")
    created = client.post(
        "/api/v1/admin/organizations",
        json={**ORG_FIELDS, "management_mode": "RETAIN_PLATFORM_MANAGEMENT"},
    )
    approved = client.post(
        f"/api/v1/admin/organization-requests/{submitted['id']}/approve"
    )

    assert pending.status_code == 403
    assert created.status_code == 403
    assert approved.status_code == 403


def test_super_admin_approves_request_and_assigns_requester_owner(client):
    owner = sync_identity(client, owner_claims())
    submitted = client.post(
        "/api/v1/organizations/requests",
        json=ORG_FIELDS,
    ).json()
    admin = promote_to_platform_admin(client, admin_claims())

    queue = client.get("/api/v1/admin/organization-requests")
    assert queue.status_code == 200
    assert submitted["id"] in [item["id"] for item in queue.json()["items"]]
    detail = client.get(f"/api/v1/admin/organization-requests/{submitted['id']}")
    assert detail.status_code == 200
    assert detail.json()["requested_by"] == owner["id"]

    approved = client.post(
        f"/api/v1/admin/organization-requests/{submitted['id']}/approve"
    )

    assert approved.status_code == 200
    organization = approved.json()
    assert organization["status"] == "ACTIVE"
    assert organization["slug"] == "north-coast-university"
    assert organization["created_by"] == owner["id"]
    assert organization["approved_by"] == admin["id"]
    assignment = read_db_rows(
        client,
        select(OrganizationManagementAssignment).where(
            OrganizationManagementAssignment.organization_id
            == uuid.UUID(organization["id"])
        ),
    )[0]
    assert assignment.user_id == uuid.UUID(owner["id"])
    assert assignment.role == OrganizationManagementRole.OWNER
    rbac_assignment = read_db_rows(
        client,
        select(OrganizationRoleAssignment).where(
            OrganizationRoleAssignment.organization_id
            == uuid.UUID(organization["id"]),
            OrganizationRoleAssignment.status == AssignmentStatus.ACTIVE,
        ),
    )[0]
    assert rbac_assignment.user_id == uuid.UUID(owner["id"])
    assert rbac_assignment.role == OrganizationRole.ORGANISATION_OWNER
    request = read_db_rows(
        client,
        select(OrganizationRequest).where(
            OrganizationRequest.id == uuid.UUID(submitted["id"])
        ),
    )[0]
    assert request.status == OrganizationRequestStatus.APPROVED


def test_super_admin_rejects_request_with_recorded_reason(client):
    sync_identity(client, VALID_CLAIMS)
    submitted = client.post(
        "/api/v1/organizations/requests",
        json=ORG_FIELDS,
    ).json()
    promote_to_platform_admin(client, admin_claims())

    response = client.post(
        f"/api/v1/admin/organization-requests/{submitted['id']}/reject",
        json={"reason": "Insufficient supporting information."},
    )

    assert response.status_code == 200
    assert response.json()["status"] == "REJECTED"
    assert response.json()["rejection_reason"] == "Insufficient supporting information."


def test_direct_creation_retains_management_for_platform_admin(client):
    admin = promote_to_platform_admin(client, admin_claims())

    response = make_direct_organization(client)

    assert response.status_code == 201
    organization = response.json()
    assert organization["status"] == "ACTIVE"
    assignments = read_db_rows(
        client,
        select(OrganizationManagementAssignment).where(
            OrganizationManagementAssignment.organization_id
            == uuid.UUID(organization["id"])
        ),
    )
    rbac_assignments = read_db_rows(
        client,
        select(OrganizationRoleAssignment).where(
            OrganizationRoleAssignment.organization_id
            == uuid.UUID(organization["id"]),
            OrganizationRoleAssignment.status == AssignmentStatus.ACTIVE,
        ),
    )
    assert assignments == []
    assert rbac_assignments == []
    assert read_user(client, admin["id"]).is_platform_super_admin is True
    actions = read_db_rows(
        client,
        select(OrganizationAuditLog.action).where(
            OrganizationAuditLog.organization_id == uuid.UUID(organization["id"])
        ),
    )
    assert {row for row in actions} >= {
        "ORGANIZATION_CREATED_DIRECTLY",
        "ORGANIZATION_MANAGEMENT_RETAINED",
    }


def test_direct_creation_can_assign_an_existing_user_as_owner(client):
    owner = sync_identity(client, owner_claims())
    promote_to_platform_admin(client, admin_claims())

    response = make_direct_organization(
        client,
        management_mode="ASSIGN_OWNER",
        manager_user_id=owner["id"],
    )

    assert response.status_code == 201
    assignment = read_db_rows(
        client,
        select(OrganizationManagementAssignment).where(
            OrganizationManagementAssignment.organization_id
            == uuid.UUID(response.json()["id"])
        ),
    )[0]
    assert assignment.user_id == uuid.UUID(owner["id"])
    assert assignment.role == OrganizationManagementRole.OWNER


def test_handover_removes_platform_admin_assignment_but_keeps_platform_role(client):
    owner = sync_identity(client, owner_claims())
    admin = promote_to_platform_admin(client, admin_claims())
    created = make_direct_organization(client)
    organization_id = created.json()["id"]
    use_identity(client, admin_claims())

    response = client.put(
        f"/api/v1/admin/organizations/{organization_id}/management",
        json={
            "management_mode": "ASSIGN_OWNER",
            "manager_user_id": owner["id"],
        },
    )

    assert response.status_code == 200
    assert response.json()["user_id"] == owner["id"]
    assignments = read_db_rows(
        client,
        select(OrganizationManagementAssignment).where(
            OrganizationManagementAssignment.organization_id
            == uuid.UUID(organization_id)
        ),
    )
    assert all(assignment.user_id != uuid.UUID(admin["id"]) for assignment in assignments)
    assert any(
        assignment.user_id == uuid.UUID(owner["id"])
        and assignment.role == OrganizationManagementRole.OWNER
        for assignment in assignments
    )
    assert read_user(client, admin["id"]).is_platform_super_admin is True


def test_active_organization_is_discoverable_but_management_is_still_restricted(client):
    owner = sync_identity(client, owner_claims())
    promote_to_platform_admin(client, admin_claims())
    created = make_direct_organization(
        client,
        management_mode="ASSIGN_OWNER",
        manager_user_id=owner["id"],
    )
    organization_id = created.json()["id"]

    outsider_claims = {
        **VALID_CLAIMS,
        "uid": "organization-outsider",
        "email": "outsider@example.com",
        "name": "Organisation Outsider",
    }
    sync_identity(client, outsider_claims)
    outsider = client.get(f"/api/v1/organizations/{organization_id}")
    assert outsider.status_code == 200

    use_identity(client, owner_claims())
    manager = client.get(f"/api/v1/organizations/{organization_id}")
    assert manager.status_code == 200
    assert manager.json()["id"] == organization_id


def test_duplicate_organization_slug_returns_conflict(client):
    promote_to_platform_admin(client, admin_claims())
    first = make_direct_organization(client, slug="north-coast")
    second = make_direct_organization(
        client,
        name="Another University",
        slug="north-coast",
    )

    assert first.status_code == 201
    assert second.status_code == 409


def test_approval_slug_collision_leaves_request_pending(client):
    sync_identity(client, VALID_CLAIMS)
    submitted = client.post(
        "/api/v1/organizations/requests",
        json=ORG_FIELDS,
    ).json()
    promote_to_platform_admin(client, admin_claims())
    directly_created = make_direct_organization(client)
    assert directly_created.status_code == 201

    approval = client.post(
        f"/api/v1/admin/organization-requests/{submitted['id']}/approve"
    )
    request_after_conflict = client.get(
        f"/api/v1/admin/organization-requests/{submitted['id']}"
    )

    assert approval.status_code == 409
    assert request_after_conflict.json()["status"] == "PENDING_APPROVAL"


def test_direct_creation_requires_a_consistent_management_choice(client):
    promote_to_platform_admin(client, admin_claims())

    missing_owner = make_direct_organization(
        client,
        management_mode="ASSIGN_OWNER",
    )
    unexpected_owner = make_direct_organization(
        client,
        management_mode="RETAIN_PLATFORM_MANAGEMENT",
        manager_user_id=str(uuid.uuid4()),
    )

    assert missing_owner.status_code == 422
    assert unexpected_owner.status_code == 422


def test_direct_creation_rejects_a_nonexistent_owner_without_creating_a_row(client):
    promote_to_platform_admin(client, admin_claims())
    nonexistent_owner = uuid.uuid4()

    before = client.get("/api/v1/admin/organizations")
    response = make_direct_organization(
        client,
        name="Ownerless University",
        slug="ownerless-university",
        management_mode="ASSIGN_OWNER",
        manager_user_id=str(nonexistent_owner),
    )
    after = client.get("/api/v1/admin/organizations")

    assert before.status_code == 200
    assert response.status_code == 404
    assert after.status_code == 200
    assert all(
        item["slug"] != "ownerless-university"
        for item in after.json()["items"]
    )


def test_organization_can_be_suspended_and_restored(client):
    promote_to_platform_admin(client, admin_claims())
    created = make_direct_organization(client)
    organization_id = created.json()["id"]

    suspended = client.post(
        f"/api/v1/admin/organizations/{organization_id}/suspend"
    )
    restored = client.post(
        f"/api/v1/admin/organizations/{organization_id}/restore"
    )

    assert suspended.status_code == 200
    assert suspended.json()["status"] == "SUSPENDED"
    assert restored.status_code == 200
    assert restored.json()["status"] == "ACTIVE"
    actions = read_db_rows(
        client,
        select(OrganizationAuditLog.action).where(
            OrganizationAuditLog.organization_id == uuid.UUID(organization_id)
        ),
    )
    assert "ORGANIZATION_SUSPENDED" in actions
    assert "ORGANIZATION_RESTORED" in actions


def test_ordinary_user_cannot_suspend_an_organization(client):
    sync_identity(client, VALID_CLAIMS)
    promote_to_platform_admin(client, admin_claims())
    created = make_direct_organization(client)

    use_identity(client, VALID_CLAIMS)
    response = client.post(
        f"/api/v1/admin/organizations/{created.json()['id']}/suspend"
    )

    assert response.status_code == 403


def test_platform_admin_list_includes_organizations_across_statuses(client):
    promote_to_platform_admin(client, admin_claims())
    created = make_direct_organization(client)
    organization_id = uuid.UUID(created.json()["id"])
    client.post(f"/api/v1/admin/organizations/{organization_id}/suspend")

    response = client.get("/api/v1/admin/organizations")
    suspended = client.get("/api/v1/admin/organizations?status=SUSPENDED")

    assert response.status_code == 200
    assert any(item["id"] == str(organization_id) for item in response.json()["items"])
    assert [item["id"] for item in suspended.json()["items"]] == [str(organization_id)]


def test_account_deletion_is_blocked_before_firebase_for_organization_manager(
    client,
    monkeypatch,
):
    admin = promote_to_platform_admin(client, admin_claims())
    assert make_direct_organization(client).status_code == 201
    deleted_uids = []
    monkeypatch.setattr("app.services.users.delete_firebase_user", deleted_uids.append)
    use_identity(client, {**admin_claims(), "auth_time": int(time.time())})

    response = client.delete("/api/v1/users/me")

    assert response.status_code == 409
    assert "organisation creation or management" in response.json()["detail"]
    assert deleted_uids == []
    assert read_user(client, admin["id"]).is_active is True


def test_ordinary_user_can_discover_active_organizations(client):
    promote_to_platform_admin(client, admin_claims())
    created = make_direct_organization(client)
    assert created.status_code == 201

    use_identity(client, VALID_CLAIMS)
    sync_identity(client, VALID_CLAIMS)
    listed = client.get("/api/v1/organizations")
    detail = client.get(f"/api/v1/organizations/{created.json()['id']}")

    assert listed.status_code == 200
    assert created.json()["id"] in [item["id"] for item in listed.json()["items"]]
    assert detail.status_code == 200
    assert detail.json()["id"] == created.json()["id"]


def test_unauthenticated_user_cannot_discover_organizations(client):
    client.app.dependency_overrides.pop(get_firebase_claims)

    listed = client.get("/api/v1/organizations")
    detail = client.get(f"/api/v1/organizations/{uuid.uuid4()}")

    assert listed.status_code == 401
    assert detail.status_code == 401


def test_ordinary_user_cannot_discover_suspended_organization_details(client):
    promote_to_platform_admin(client, admin_claims())
    created = make_direct_organization(client)
    organization_id = created.json()["id"]
    suspended = client.post(
        f"/api/v1/admin/organizations/{organization_id}/suspend"
    )
    assert suspended.status_code == 200

    use_identity(client, VALID_CLAIMS)
    sync_identity(client, VALID_CLAIMS)
    listed = client.get("/api/v1/organizations")
    detail = client.get(f"/api/v1/organizations/{organization_id}")

    assert listed.status_code == 200
    assert organization_id not in [item["id"] for item in listed.json()["items"]]
    assert detail.status_code == 404


def test_owner_and_admin_management_assignment_can_use_mine(client):
    owner = sync_identity(client, owner_claims())
    promote_to_platform_admin(client, admin_claims())
    created = client.post(
        "/api/v1/admin/organizations",
        json={
            **ORG_FIELDS,
            "management_mode": "ASSIGN_OWNER",
            "manager_user_id": owner["id"],
        },
    )
    assert created.status_code == 201

    use_identity(client, owner_claims())
    mine = client.get("/api/v1/organizations/mine")
    detail = client.get(f"/api/v1/organizations/{created.json()['id']}")

    assert mine.status_code == 200
    assert created.json()["id"] in [item["id"] for item in mine.json()["items"]]
    assert detail.status_code == 200


def test_member_request_lifecycle_approval_and_duplicate_prevention(client):
    applicant_claims_value = {
        **VALID_CLAIMS,
        "uid": "membership-applicant",
        "email": "membership-applicant@example.com",
        "name": "Membership Applicant",
    }
    applicant = sync_identity(client, applicant_claims_value)
    promote_to_platform_admin(client, admin_claims())
    owner = sync_identity(client, owner_claims())
    use_identity(client, admin_claims())
    organization = make_direct_organization(
        client,
        management_mode="ASSIGN_OWNER",
        manager_user_id=owner["id"],
    )
    assert organization.status_code == 201
    organization_id = organization.json()["id"]

    use_identity(client, applicant_claims_value)
    first = client.post(
        f"/api/v1/organizations/{organization_id}/membership-requests",
        json={"message": "Please accept me."},
    )
    duplicate = client.post(
        f"/api/v1/organizations/{organization_id}/membership-requests",
        json={"message": "Duplicate."},
    )
    status_response = client.get(
        f"/api/v1/organizations/{organization_id}/membership/status"
    )

    assert first.status_code == 200
    assert duplicate.status_code == 409
    assert status_response.status_code == 200
    assert status_response.json()["membership_request_status"] == "PENDING"
    assert status_response.json()["membership_status"] is None

    use_identity(client, owner_claims())
    pending = client.get(
        f"/api/v1/admin/organizations/{organization_id}/membership-requests"
    )
    assert pending.status_code == 200
    pending_item = pending.json()["items"][0]
    assert pending_item["applicant_name"] == "Membership Applicant"
    assert pending_item["applicant_email"] == "membership-applicant@example.com"

    approved = client.post(
        f"/api/v1/admin/organizations/{organization_id}/membership-requests/{first.json()['id']}/approve"
    )
    assert approved.status_code == 200

    use_identity(client, applicant_claims_value)
    status_response = client.get(
        f"/api/v1/organizations/{organization_id}/membership/status"
    )
    mine = client.get("/api/v1/organizations/membership/my")
    assert status_response.json()["membership_status"] == "ACTIVE"
    assert mine.status_code == 200
    assert organization_id in [
        item["organization_id"] for item in mine.json()["items"]
    ]


def test_rejection_preserves_reason_and_unrelated_admin_cannot_review(client):
    applicant_claims_value = {
        **VALID_CLAIMS,
        "uid": "rejected-applicant",
        "email": "rejected-applicant@example.com",
        "name": "Rejected Applicant",
    }
    applicant = sync_identity(client, applicant_claims_value)
    owner = sync_identity(client, owner_claims())
    promote_to_platform_admin(client, admin_claims())
    organization = make_direct_organization(
        client,
        management_mode="ASSIGN_OWNER",
        manager_user_id=owner["id"],
    )
    organization_id = organization.json()["id"]

    use_identity(client, applicant_claims_value)
    request = client.post(
        f"/api/v1/organizations/{organization_id}/membership-requests",
        json={"message": "Join for community events."},
    )
    assert request.status_code == 200

    outsider_claims_value = {
        **VALID_CLAIMS,
        "uid": "unrelated-org-admin",
        "email": "unrelated-org-admin@example.com",
        "name": "Unrelated Admin",
    }
    sync_identity(client, outsider_claims_value)
    unauthorized = client.get(
        f"/api/v1/admin/organizations/{organization_id}/membership-requests"
    )
    assert unauthorized.status_code == 403

    use_identity(client, owner_claims())
    rejected = client.post(
        f"/api/v1/admin/organizations/{organization_id}/membership-requests/{request.json()['id']}/reject",
        json={"reason": "Application does not meet current membership policy."},
    )
    assert rejected.status_code == 200
    assert rejected.json()["status"] == "REJECTED"
    assert rejected.json()["rejection_reason"] == "Application does not meet current membership policy."
    assert rejected.json()["reviewed_by"] is not None
    assert rejected.json()["reviewed_at"] is not None


def test_legacy_creator_owner_assignment_can_review_membership_requests(client):
    applicant_claims_value = {
        **VALID_CLAIMS,
        "uid": "creator-review-applicant",
        "email": "creator-review-applicant@example.com",
        "name": "Creator Review Applicant",
    }
    applicant = sync_identity(client, applicant_claims_value)
    owner = sync_identity(client, owner_claims())

    promote_to_platform_admin(client, admin_claims())
    organization = make_direct_organization(
        client,
        management_mode="ASSIGN_OWNER",
        manager_user_id=owner["id"],
    )
    organization_id = organization.json()["id"]

    use_identity(client, applicant_claims_value)
    request = client.post(
        f"/api/v1/organizations/{organization_id}/membership-requests",
        json={"message": "Please review my membership."},
    )
    assert request.status_code == 200

    use_identity(client, owner_claims())
    pending = client.get(
        f"/api/v1/admin/organizations/{organization_id}/membership-requests"
    )
    approved = client.post(
        f"/api/v1/admin/organizations/{organization_id}/membership-requests/{request.json()['id']}/approve"
    )

    assert pending.status_code == 200
    pending_item = pending.json()["items"][0]
    assert pending_item["applicant_name"] == "Creator Review Applicant"
    assert pending_item["applicant_email"] == "creator-review-applicant@example.com"
    assert approved.status_code == 200
    assert approved.json()["status"] == "APPROVED"
