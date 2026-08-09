from __future__ import annotations

import logging

import firebase_admin
from firebase_admin import auth, credentials

from app.core.config import settings

logger = logging.getLogger(__name__)

_firebase_app: firebase_admin.App | None = None


def initialize_firebase() -> None:
    """
    Initialize the Firebase Admin SDK exactly once.
    Called from main.py on application startup.

    Credentials are built from individual environment variables so that no
    service-account JSON file needs to be committed to the repository.
    """
    global _firebase_app

    if _firebase_app is not None:
        return

    cred_dict = {
        "type": "service_account",
        "project_id": settings.FIREBASE_PROJECT_ID,
        "private_key": settings.firebase_private_key_decoded,
        "client_email": settings.FIREBASE_CLIENT_EMAIL,
        "token_uri": "https://oauth2.googleapis.com/token",
        # These fields are required by the SDK but are not sensitive.
        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
        "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
        "client_x509_cert_url": (
            f"https://www.googleapis.com/robot/v1/metadata/x509/"
            f"{settings.FIREBASE_CLIENT_EMAIL.replace('@', '%40')}"
        ),
    }

    cred = credentials.Certificate(cred_dict)
    _firebase_app = firebase_admin.initialize_app(cred)
    logger.info("Firebase Admin SDK initialised for project: %s", settings.FIREBASE_PROJECT_ID)


async def verify_firebase_token(token: str) -> dict:
    """
    Verify a Firebase ID token using the Admin SDK.

    Returns the decoded token payload (contains uid, email, etc.) on success.
    Raises firebase_admin.auth.InvalidIdTokenError on any verification failure.

    Security note:
        - This performs a full cryptographic signature check against Firebase's
          public certificates.  Do NOT replace this with manual JWT decoding.
        - Expired, revoked, and malformed tokens are all rejected automatically.
    """
    try:
        decoded_token: dict = auth.verify_id_token(token)
        return decoded_token
    except auth.ExpiredIdTokenError as exc:
        logger.warning("Expired Firebase token: %s", exc)
        raise
    except auth.RevokedIdTokenError as exc:
        logger.warning("Revoked Firebase token: %s", exc)
        raise
    except auth.InvalidIdTokenError as exc:
        logger.warning("Invalid Firebase token: %s", exc)
        raise
    except Exception as exc:
        logger.error("Unexpected error verifying Firebase token: %s", exc)
        raise
