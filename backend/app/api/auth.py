from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, get_verified_firebase_token, require_admin
from app.core.config import settings
from app.database.session import get_db
from app.models.user import User, UserRole
from app.models.student import Student
from app.schemas.user import (
    StudentVerificationResponse,
    UserUpdateRequest,
    UserResponse,
    UserSyncRequest,
    UserSyncResponse,
)
from app.services.student_records import find_student_by_id
from app.services.student_verification import compare_identity

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

VERIFICATION_FAILURE_MESSAGE = (
    "We couldn't verify your student information. Please make sure the information "
    "you provided matches your official university records."
)


@router.post("/sync", response_model=UserSyncResponse)
async def sync_user(
    payload: UserSyncRequest,
    decoded_token: dict = Depends(get_verified_firebase_token),
    db: AsyncSession = Depends(get_db),
) -> UserSyncResponse:
    firebase_uid = decoded_token.get("uid", "")
    token_email = (decoded_token.get("email") or "").strip().lower()

    if not firebase_uid:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token payload missing UID.")

    existing_user = (
        await db.execute(select(User).where(User.firebase_uid == firebase_uid))
    ).scalar_one_or_none()
    if existing_user is not None:
        # Firebase users created before their profile was fully synced can have
        # no student ID. Fill that missing identity data from the trusted,
        # authenticated registration payload so they can be verified.
        if payload.student_id and payload.student_id != existing_user.student_id:
            student_id_owner = (
                await db.execute(
                    select(User).where(
                        User.student_id == payload.student_id,
                        User.id != existing_user.id,
                    )
                )
            ).scalar_one_or_none()
            if student_id_owner is not None:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="This Student ID is already registered.",
                )
            existing_user.student_id = payload.student_id
            existing_user.is_verified = False
            existing_user.verified_at = None

        if payload.full_name.strip() and payload.full_name != existing_user.full_name:
            existing_user.full_name = payload.full_name
            existing_user.is_verified = False
            existing_user.verified_at = None

        await db.flush()
        await db.refresh(existing_user)
        return UserSyncResponse(user=existing_user, created=False)

    if token_email and token_email != payload.email.strip().lower():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Registration email does not match the authenticated Firebase account.")

    if (await db.execute(select(User).where(User.email == payload.email.strip().lower()))).scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An account with this email already exists.")

    if payload.student_id:
        if (await db.execute(select(User).where(User.student_id == payload.student_id))).scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This Student ID is already registered.")

    new_user = User(
        firebase_uid=firebase_uid,
        full_name=payload.full_name,
        email=payload.email.strip().lower(),
        student_id=payload.student_id,
        role=UserRole.STUDENT,
        is_active=True,
        is_verified=False,
    )
    db.add(new_user)
    await db.flush()
    await db.refresh(new_user)
    return UserSyncResponse(user=new_user, created=True)


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)) -> UserResponse:
    return current_user


@router.get("/admin/dashboard-stats")
async def get_admin_dashboard_stats(
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> dict[str, int]:
    """Return dashboard counts from the database for Super Admins only."""
    registered_users = (await db.execute(select(func.count()).select_from(User))).scalar_one()

    verified_voters = (
        await db.execute(
            select(func.count()).select_from(User).where(
                User.role == UserRole.STUDENT,
                User.is_active.is_(True),
                User.is_verified.is_(True),
            )
        )
    ).scalar_one()

    eligible_conditions = [
        User.role == UserRole.STUDENT,
        User.is_active.is_(True),
        User.is_verified.is_(True),
        Student.status == "ACTIVE",
    ]
    # This mirrors the current default eligibility criteria used by the API.
    if settings.DEFAULT_ELIGIBLE_DEPARTMENT.strip().lower() != "all":
        eligible_conditions.append(
            func.lower(Student.department) == settings.DEFAULT_ELIGIBLE_DEPARTMENT.strip().lower()
        )
    eligible_voters = (
        await db.execute(
            select(func.count()).select_from(User).join(Student, User.student_id == Student.student_id).where(*eligible_conditions)
        )
    ).scalar_one()

    return {
        "registered_users": registered_users,
        "eligible_voters": eligible_voters,
        "verified_voters": verified_voters,
    }


@router.patch("/me", response_model=UserResponse)
async def update_me(
    payload: UserUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    profile_identity_changed = False
    if "full_name" in payload.model_fields_set and payload.full_name != current_user.full_name:
        current_user.full_name = payload.full_name or current_user.full_name
        profile_identity_changed = True

    if "student_id" in payload.model_fields_set and payload.student_id != current_user.student_id:
        if payload.student_id:
            student_id_owner = (
                await db.execute(
                    select(User).where(
                        User.student_id == payload.student_id,
                        User.id != current_user.id,
                    )
                )
            ).scalar_one_or_none()
            if student_id_owner is not None:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="This Student ID is already linked to another account.",
                )

        current_user.student_id = payload.student_id
        profile_identity_changed = True

    if profile_identity_changed:
        # Changed registration identity must be checked against official records again.
        current_user.is_verified = False
        current_user.verified_at = None

    await db.flush()
    await db.refresh(current_user)
    return current_user


@router.post("/verify-student", response_model=StudentVerificationResponse)
async def verify_student(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> StudentVerificationResponse:
    official_student = await find_student_by_id(db, current_user.student_id)

    conflict = (
        await db.execute(select(User).where(User.student_id == current_user.student_id, User.id != current_user.id))
    ).scalar_one_or_none()
    if conflict is not None:
        logger.warning("Student verification failed user_id=%s reason=student_id_already_linked", current_user.id)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=VERIFICATION_FAILURE_MESSAGE)

    comparison = compare_identity(current_user, official_student)
    if not comparison.verified:
        logger.warning("Student verification failed user_id=%s reason=%s", current_user.id, comparison.audit_reason)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=VERIFICATION_FAILURE_MESSAGE)

    current_user.student_id = official_student.student_id
    current_user.is_verified = True
    current_user.verified_at = datetime.now(timezone.utc)
    # Commit here so a successful verification is durable before responding.
    await db.commit()
    await db.refresh(current_user)
    logger.info("Student verification succeeded user_id=%s", current_user.id)
    return StudentVerificationResponse(success=True, message="Student account verified.", is_verified=True, user=current_user)
