from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.database.session import get_db
from app.models.user import User, UserRole
from app.schemas.user import UserResponse, UserSyncRequest, UserSyncResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


# ── POST /api/auth/sync ───────────────────────────────────────────────────────

@router.post(
    "/sync",
    response_model=UserSyncResponse,
    summary="Sync Firebase user to PostgreSQL",
    description=(
        "Called by the frontend after Firebase authentication. "
        "Creates a new PostgreSQL user record if one does not exist, "
        "or returns the existing record. "
        "The role is ALWAYS forced to STUDENT regardless of any client input."
    ),
)
async def sync_user(
    payload: UserSyncRequest,
    db: AsyncSession = Depends(get_db),
) -> UserSyncResponse:
    """
    Synchronise a Firebase-authenticated user into the PostgreSQL database.

    This endpoint is intentionally NOT protected by get_current_user so that
    it can be called immediately after registration before the user record exists.
    However, the client MUST supply a valid firebase_uid that was obtained from
    Firebase — in a stricter production setup you may want to verify the token
    here too.

    Security note on roles:
        The role field is NEVER read from the client payload.
        All new users receive UserRole.STUDENT unconditionally.
    """
    # Check for existing user by firebase_uid (authoritative identifier)
    result = await db.execute(select(User).where(User.firebase_uid == payload.firebase_uid))
    existing_user = result.scalar_one_or_none()

    if existing_user is not None:
        logger.info("Sync: existing user found for firebase_uid=%s", payload.firebase_uid)
        return UserSyncResponse(user=existing_user, created=False)

    # Check for email collision (edge case: same email, different Firebase account)
    email_result = await db.execute(select(User).where(User.email == str(payload.email)))
    if email_result.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    # Check for student_id collision if provided
    if payload.student_id:
        sid_result = await db.execute(
            select(User).where(User.student_id == payload.student_id)
        )
        if sid_result.scalar_one_or_none() is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This Student ID is already registered.",
            )

    # Create new user — role is ALWAYS STUDENT, never from the client
    new_user = User(
        firebase_uid=payload.firebase_uid,
        full_name=payload.full_name,
        email=str(payload.email),
        student_id=payload.student_id,
        role=UserRole.STUDENT,  # ← NEVER from client
        is_active=True,
    )
    db.add(new_user)
    await db.flush()  # Assign ID before returning
    await db.refresh(new_user)

    logger.info(
        "Sync: created new user id=%s firebase_uid=%s email=%s",
        new_user.id,
        new_user.firebase_uid,
        new_user.email,
    )

    return UserSyncResponse(user=new_user, created=True)


# ── GET /api/auth/me ──────────────────────────────────────────────────────────

@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get current authenticated user",
    description=(
        "Returns the PostgreSQL user record for the currently authenticated user. "
        "Requires a valid Firebase ID token in the Authorization header."
    ),
)
async def get_me(current_user: User = Depends(get_current_user)) -> UserResponse:
    """
    Protected endpoint — returns the authenticated user's application profile.

    The Firebase ID token is verified by the get_current_user dependency before
    this handler is called.  The response never includes sensitive fields.
    """
    return current_user
