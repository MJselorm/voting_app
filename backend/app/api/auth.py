from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, get_verified_firebase_token
from app.database.session import get_db
from app.models.student import Student
from app.models.user import User, UserRole
from app.schemas.user import (
    StudentVerificationResponse,
    UserResponse,
    UserSyncRequest,
    UserSyncResponse,
)
from app.services.identity import names_match, verify_email_match

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


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


@router.post("/verify-student", response_model=StudentVerificationResponse)
async def verify_student(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> StudentVerificationResponse:
    if not current_user.student_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="We couldn't verify your student information. Please check that your Student ID and university email match your official student records.",
        )

    official_student = (
        await db.execute(select(Student).where(Student.student_id == current_user.student_id))
    ).scalar_one_or_none()
    if official_student is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="We couldn't verify your student information. Please check that your Student ID and university email match your official student records.")

    conflict = (
        await db.execute(select(User).where(User.student_id == current_user.student_id, User.id != current_user.id))
    ).scalar_one_or_none()
    if conflict is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This Student ID is already linked to another account.")

    if not verify_email_match(current_user.email, official_student.email):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="We couldn't verify your student information. Please check that your Student ID and university email match your official student records.")

    if not names_match(current_user.full_name, official_student.full_name):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="We couldn't verify your student information. Please check that your Student ID and university email match your official student records.")

    current_user.student_id = official_student.student_id
    current_user.is_verified = True
    current_user.verified_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(current_user)
    return StudentVerificationResponse(success=True, message="Student account verified.", is_verified=True, user=current_user)
