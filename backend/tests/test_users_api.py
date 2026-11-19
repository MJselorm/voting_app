import time
from unittest.mock import Mock

import pytest
from fastapi import HTTPException, status
from firebase_admin.exceptions import FirebaseError
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.auth.dependencies import get_firebase_claims
from app.auth.firebase import delete_firebase_user
from app.database.session import get_db
from app.models.user import User
from app.services.users import delete_user_account
from tests.factories import VALID_CLAIMS


def verified_recent_claims():
    return {**VALID_CLAIMS, "auth_time": int(time.time())}


def test_v1_profile_reads_the_authenticated_users_record(client):
    synced = client.post("/api/auth/sync").json()

    response = client.get("/api/v1/users/me")

    assert response.status_code == 200
    assert response.json()["id"] == synced["id"]
    assert response.json()["email"] == "person@example.com"


def test_v1_profile_rejects_unauthenticated_requests(client):
    client.app.dependency_overrides.pop(get_firebase_claims)

    response = client.get("/api/v1/users/me")

    assert response.status_code == 401


def test_v1_profile_updates_only_allowed_fields(client):
    client.post("/api/auth/sync")

    response = client.patch(
        "/api/v1/users/me",
        json={"full_name": "  Updated   Name  "},
    )

    assert response.status_code == 200
    assert response.json()["full_name"] == "Updated Name"
    assert response.json()["email"] == "person@example.com"


@pytest.mark.parametrize(
    "profile_update",
    [
        {"full_name": "x"},
        {"full_name": "Valid Name", "is_active": False},
        {"full_name": "Valid Name", "id": "another-id"},
        {"full_name": "Valid Name", "firebase_uid": "another-user"},
        {"full_name": "Valid Name", "role": "admin"},
        {"email": "new@example.com"},
    ],
)
def test_v1_profile_rejects_invalid_or_protected_updates(client, profile_update):
    client.post("/api/auth/sync")

    response = client.patch("/api/v1/users/me", json=profile_update)

    assert response.status_code == 422


def test_v1_me_never_accepts_another_users_id_as_the_target(client):
    own_profile = client.post("/api/auth/sync").json()
    response = client.get(f"/api/v1/users/me?user_id={own_profile['id']}")

    assert response.status_code == 200
    assert response.json()["id"] == own_profile["id"]


def test_account_deletion_requires_recent_reauthentication(client):
    client.post("/api/auth/sync")
    client.app.dependency_overrides[get_firebase_claims] = lambda: dict(VALID_CLAIMS)

    response = client.delete("/api/v1/users/me")

    assert response.status_code == 403
    assert response.json()["detail"] == "Reauthenticate before deleting your account."


def test_account_deletion_removes_only_the_authenticated_account(client, monkeypatch):
    own_profile = client.post("/api/auth/sync").json()
    db = next(client.app.dependency_overrides[get_db]())
    other_user = User(
        firebase_uid="other-firebase-uid",
        full_name="Other Person",
        email="other@example.com",
        is_active=True,
    )
    db.add(other_user)
    db.commit()
    db.close()
    deleted_uids = []
    monkeypatch.setattr("app.services.users.delete_firebase_user", deleted_uids.append)
    client.app.dependency_overrides[get_firebase_claims] = verified_recent_claims

    response = client.request(
        "DELETE",
        "/api/v1/users/me",
        json={"firebase_uid": "other-firebase-uid"},
    )

    assert response.status_code == 200
    assert response.json()["message"] == "Your account was permanently deleted."
    assert deleted_uids == ["firebase-user-1"]
    assert client.get("/api/v1/users/me").status_code == 404
    db = next(client.app.dependency_overrides[get_db]())
    assert db.scalar(
        select(User).where(User.firebase_uid == "other-firebase-uid")
    ) is not None
    db.close()


def test_firebase_deletion_failure_restores_the_application_profile(client, monkeypatch):
    client.post("/api/auth/sync")
    client.app.dependency_overrides[get_firebase_claims] = verified_recent_claims

    def fail_delete(_uid: str) -> None:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Firebase deletion failed.",
        )

    monkeypatch.setattr("app.services.users.delete_firebase_user", fail_delete)

    response = client.delete("/api/v1/users/me")

    assert response.status_code == 502
    assert "profile was reactivated" in response.json()["detail"]
    assert client.get("/api/v1/users/me").status_code == 200


def test_profile_restore_failure_is_reported_as_incomplete_deletion(client, monkeypatch):
    client.post("/api/auth/sync")
    client.app.dependency_overrides[get_firebase_claims] = verified_recent_claims

    def fail_delete(_uid: str) -> None:
        raise HTTPException(status_code=502, detail="Firebase unavailable.")

    monkeypatch.setattr("app.services.users.delete_firebase_user", fail_delete)
    original_commit = Session.commit
    commits = 0

    def fail_restore_commit(session):
        nonlocal commits
        commits += 1
        if commits == 2:
            raise SQLAlchemyError("database unavailable during profile restore")
        original_commit(session)

    monkeypatch.setattr(Session, "commit", fail_restore_commit)

    response = client.delete("/api/v1/users/me")

    assert response.status_code == 503
    assert "could not be reactivated" in response.json()["detail"]
    assert client.get("/api/v1/users/me").status_code == 403


def test_neon_delete_failure_after_firebase_delete_leaves_profile_inactive(
    client,
    monkeypatch,
):
    client.post("/api/auth/sync")
    client.app.dependency_overrides[get_firebase_claims] = verified_recent_claims
    deleted_uids = []
    monkeypatch.setattr("app.services.users.delete_firebase_user", deleted_uids.append)
    original_commit = Session.commit
    commits = 0

    def fail_final_delete(session):
        nonlocal commits
        commits += 1
        if commits == 2:
            raise SQLAlchemyError("database unavailable after Firebase deletion")
        original_commit(session)

    monkeypatch.setattr(Session, "commit", fail_final_delete)

    response = client.delete("/api/v1/users/me")

    assert response.status_code == 503
    assert "Firebase account was deleted" in response.json()["detail"]
    assert deleted_uids == ["firebase-user-1"]
    assert client.get("/api/v1/users/me").status_code == 403


def test_unauthenticated_account_deletion_is_rejected(client):
    client.app.dependency_overrides.pop(get_firebase_claims)

    response = client.delete("/api/v1/users/me")

    assert response.status_code == 401


def test_database_delete_failure_does_not_call_firebase(monkeypatch):
    from app.services import users as user_service

    db = Mock()
    db.commit.side_effect = SQLAlchemyError("database unavailable")
    db.scalar.return_value = None
    user = User(
        firebase_uid="firebase-user-1",
        full_name="Test Person",
        email="person@example.com",
        is_active=True,
    )
    delete_firebase = Mock()
    monkeypatch.setattr(user_service, "delete_firebase_user", delete_firebase)

    with pytest.raises(HTTPException) as error:
        delete_user_account(db, user)

    assert error.value.status_code == 503
    assert "Firebase account was not changed" in error.value.detail
    db.rollback.assert_called_once()
    delete_firebase.assert_not_called()


def test_firebase_admin_delete_errors_are_sanitized(monkeypatch):
    monkeypatch.setattr("app.auth.firebase.initialize_firebase", lambda: object())

    def fail_delete(*_args, **_kwargs):
        raise FirebaseError("UNAVAILABLE", "private provider detail")

    monkeypatch.setattr("app.auth.firebase.auth.delete_user", fail_delete)

    with pytest.raises(HTTPException) as error:
        delete_firebase_user("firebase-user-1")

    assert error.value.status_code == 502
    assert "private provider detail" not in error.value.detail
