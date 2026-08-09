from __future__ import annotations

import logging

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from firebase_admin import auth as firebase_auth
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.firebase_admin import verify_firebase_token
from app.database.session import get_db
from app.models.user import User

logger = logging.getLogger(__name__)

# Extracts Bearer token from the Authorization header.
# auto_error=False lets us return a custom 401 instead of FastAPI's default.
bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    FastAPI dependency — authenticates and returns the current application user.

    Flow:
        1. Read Authorization header.
        2. Extract Bearer token.
        3. Verify token cryptographically via Firebase Admin SDK.
        4. Extract Firebase UID from the verified token.
        5. Look up the corresponding PostgreSQL User record.
        6. Return the User or raise 401/403.

    Security:
        - Missing token → 401
        - Invalid / expired / malformed token → 401
        - Firebase UID not found in PostgreSQL → 401
        - Inactive account → 403
    """
    # ── Step 1: Ensure token is present ──────────────────────────────────
    if credentials is None or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Provide a valid Firebase ID token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials

    # ── Step 2: Verify with Firebase Admin SDK ────────────────────────────
    try:
        decoded_token = await verify_firebase_token(token)
    except firebase_auth.ExpiredIdTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except firebase_auth.RevokedIdTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has been revoked. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except (firebase_auth.InvalidIdTokenError, Exception) as exc:
        logger.warning("Token verification failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # ── Step 3: Extract Firebase UID ──────────────────────────────────────
    firebase_uid: str = decoded_token.get("uid", "")
    if not firebase_uid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token payload missing UID.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # ── Step 4: Look up PostgreSQL user ───────────────────────────────────
    result = await db.execute(select(User).where(User.firebase_uid == firebase_uid))
    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account not found. Please complete registration.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # ── Step 5: Account status check ──────────────────────────────────────
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been deactivated. Please contact support.",
        )

    return user


async def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """
    Dependency that additionally requires the user to have SUPER_ADMIN role.
    Use on admin-only endpoints.
    """
    from app.models.user import UserRole

    if current_user.role != UserRole.SUPER_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required.",
        )
    return current_user


async def require_election_official(current_user: User = Depends(get_current_user)) -> User:
    """
    Dependency that requires ELECTION_OFFICIAL or SUPER_ADMIN role.
    """
    from app.models.user import UserRole

    if current_user.role not in (UserRole.ELECTION_OFFICIAL, UserRole.SUPER_ADMIN):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Election official access required.",
        )
    return current_user
