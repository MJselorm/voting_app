from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Annotated, Any

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.firebase import verify_firebase_id_token
from app.database.session import get_db
from app.models.user import User

bearer_scheme = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class FirebaseIdentity:
    uid: str
    email: str
    full_name: str | None


def get_firebase_claims(
    credentials: Annotated[
        HTTPAuthorizationCredentials | None,
        Depends(bearer_scheme),
    ],
) -> dict[str, Any]:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="A Firebase ID token is required.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return verify_firebase_id_token(credentials.credentials)


def get_verified_identity(
    claims: Annotated[dict[str, Any], Depends(get_firebase_claims)],
) -> FirebaseIdentity:
    uid = claims.get("uid")
    email = claims.get("email")
    if not isinstance(uid, str) or not uid or not isinstance(email, str) or not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="The Firebase ID token is missing required identity claims.",
        )
    if claims.get("email_verified") is not True:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Verify your email address before continuing.",
        )
    name = claims.get("name")
    return FirebaseIdentity(
        uid=uid,
        email=email.strip().lower(),
        full_name=name.strip() if isinstance(name, str) and name.strip() else None,
    )


def get_recently_authenticated_identity(
    claims: Annotated[dict[str, Any], Depends(get_firebase_claims)],
) -> FirebaseIdentity:
    identity = get_verified_identity(claims)
    auth_time = claims.get("auth_time")
    now = int(datetime.now(timezone.utc).timestamp())
    if (
        isinstance(auth_time, bool)
        or not isinstance(auth_time, int)
        or auth_time > now + 60
        or now - auth_time > 300
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Reauthenticate before deleting your account.",
        )
    return identity


def get_active_user(
    identity: Annotated[FirebaseIdentity, Depends(get_verified_identity)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    user = db.scalar(select(User).where(User.firebase_uid == identity.uid))
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application account is not synchronized. Sign in again.",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This application account is inactive.",
        )
    return user


def get_platform_super_admin(
    user: Annotated[User, Depends(get_active_user)],
) -> User:
    if not user.is_platform_super_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Platform Super Admin access is required.",
        )
    return user
