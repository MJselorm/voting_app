import pytest
from fastapi import HTTPException
from firebase_admin import auth

from app.auth.dependencies import get_firebase_claims
from app.auth.firebase import verify_firebase_id_token
from tests.factories import VALID_CLAIMS


def test_health_checks_database(client):
    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_sync_creates_normalized_application_user(client):
    response = client.post("/api/auth/sync")

    assert response.status_code == 200
    profile = response.json()
    assert profile["email"] == "person@example.com"
    assert profile["full_name"] == "Test Person"
    assert profile["email_verified"] is True
    assert profile["is_active"] is True
    assert profile["id"]
    assert profile["created_at"]


def test_sync_is_idempotent_for_the_same_firebase_identity(client):
    first = client.post("/api/auth/sync").json()
    second = client.post("/api/auth/sync").json()

    assert second["id"] == first["id"]


def test_me_reads_synced_profile(client):
    client.post("/api/auth/sync")

    response = client.get("/api/auth/me")

    assert response.status_code == 200
    assert response.json()["email"] == "person@example.com"


def test_profile_update_changes_only_full_name(client):
    client.post("/api/auth/sync")

    response = client.patch(
        "/api/auth/me",
        json={"full_name": "  Updated   Name  "},
    )

    assert response.status_code == 200
    assert response.json()["full_name"] == "Updated Name"
    assert response.json()["email"] == "person@example.com"
    assert response.json()["is_active"] is True


def test_profile_update_rejects_privileged_fields(client):
    client.post("/api/auth/sync")

    response = client.patch(
        "/api/auth/me",
        json={"full_name": "Updated Name", "is_active": False},
    )

    assert response.status_code == 422


def test_unverified_firebase_identity_is_rejected(client):
    client.app.dependency_overrides[get_firebase_claims] = lambda: {
        **VALID_CLAIMS,
        "email_verified": False,
    }

    response = client.post("/api/auth/sync")

    assert response.status_code == 403
    assert response.json()["detail"] == "Verify your email address before continuing."


def test_unauthenticated_request_is_rejected(client):
    client.app.dependency_overrides.pop(get_firebase_claims)

    response = client.get("/api/auth/me")

    assert response.status_code == 401


def test_email_collision_does_not_create_duplicate_user(client):
    client.post("/api/auth/sync")
    client.app.dependency_overrides[get_firebase_claims] = lambda: {
        **VALID_CLAIMS,
        "uid": "another-firebase-user",
    }

    response = client.post("/api/auth/sync")

    assert response.status_code == 409
    assert response.json()["detail"] == "This email address is already associated with another account."


def test_sync_never_uses_email_or_uid_from_a_request_body(client):
    response = client.post(
        "/api/auth/sync",
        json={"email": "attacker@example.com", "firebase_uid": "attacker"},
    )

    assert response.status_code == 200
    assert response.json()["email"] == "person@example.com"


def test_valid_firebase_token_is_verified(monkeypatch):
    claims = dict(VALID_CLAIMS)
    monkeypatch.setattr("app.auth.firebase.initialize_firebase", lambda: object())
    monkeypatch.setattr(
        "app.auth.firebase.auth.verify_id_token",
        lambda *_args, **_kwargs: claims,
    )

    assert verify_firebase_id_token("valid") == claims


@pytest.mark.parametrize(
    "firebase_error",
    [
        auth.InvalidIdTokenError("invalid"),
        auth.ExpiredIdTokenError("expired", ValueError("expired")),
        auth.UserNotFoundError("deleted"),
    ],
)
def test_invalid_or_expired_firebase_token_becomes_unauthorized(
    monkeypatch,
    firebase_error,
):
    def reject_token(*_args, **_kwargs):
        raise firebase_error

    monkeypatch.setattr("app.auth.firebase.initialize_firebase", lambda: object())
    monkeypatch.setattr("app.auth.firebase.auth.verify_id_token", reject_token)
    try:
        verify_firebase_id_token("bad-token")
    except HTTPException as error:
        assert error.status_code == 401
    else:
        raise AssertionError("Invalid Firebase token was accepted.")
