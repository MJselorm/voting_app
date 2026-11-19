import json

import firebase_admin
from google.auth.exceptions import GoogleAuthError
from firebase_admin import auth, credentials
from firebase_admin.exceptions import FirebaseError
from fastapi import HTTPException, status

from app.core.config import get_settings


def initialize_firebase() -> firebase_admin.App:
    try:
        return firebase_admin.get_app()
    except ValueError:
        settings = get_settings()
        if not settings.firebase_project_id:
            raise RuntimeError("FIREBASE_PROJECT_ID must be configured.")

        credential = None
        if settings.firebase_service_account_json:
            try:
                service_account = json.loads(settings.firebase_service_account_json)
            except json.JSONDecodeError as error:
                raise RuntimeError(
                    "FIREBASE_SERVICE_ACCOUNT_JSON must contain valid JSON."
                ) from error
            credential = credentials.Certificate(service_account)

        return firebase_admin.initialize_app(
            credential,
            options={"projectId": settings.firebase_project_id},
        )


def verify_firebase_id_token(id_token: str) -> dict:
    app = initialize_firebase()
    try:
        return auth.verify_id_token(id_token, check_revoked=True, app=app)
    except (
        auth.ExpiredIdTokenError,
        auth.RevokedIdTokenError,
        auth.InvalidIdTokenError,
        auth.UserDisabledError,
        auth.UserNotFoundError,
    ) as error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Your Firebase session is invalid or expired. Sign in again.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from error


def delete_firebase_user(uid: str) -> None:
    try:
        app = initialize_firebase()
        auth.delete_user(uid, app=app)
    except auth.UserNotFoundError:
        return
    except (FirebaseError, GoogleAuthError, RuntimeError, ValueError) as error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Firebase could not delete the account. No account deletion was completed.",
        ) from error
