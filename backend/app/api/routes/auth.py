from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.dependencies import (
    FirebaseIdentity,
    get_active_user,
    get_verified_identity,
)
from app.database.session import get_db
from app.models.user import User
from app.schemas.user import UserProfile, UserProfileUpdate
from app.services.users import sync_user, update_user_profile

router = APIRouter(prefix="/auth", tags=["authentication"])


def as_profile(user: User, email_verified: bool) -> UserProfile:
    return UserProfile(
        id=user.id,
        full_name=user.full_name,
        email=user.email,
        is_active=user.is_active,
        email_verified=email_verified,
        is_platform_super_admin=user.is_platform_super_admin,
        created_at=user.created_at,
        updated_at=user.updated_at,
    )


@router.post("/sync", response_model=UserProfile)
def synchronize_account(
    identity: Annotated[FirebaseIdentity, Depends(get_verified_identity)],
    db: Annotated[Session, Depends(get_db)],
) -> UserProfile:
    user = sync_user(db, identity)
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This application account is inactive.",
        )
    return as_profile(user, email_verified=True)


@router.get("/me", response_model=UserProfile)
def get_my_profile(
    user: Annotated[User, Depends(get_active_user)],
) -> UserProfile:
    return as_profile(user, email_verified=True)


@router.patch("/me", response_model=UserProfile)
def patch_my_profile(
    update: UserProfileUpdate,
    user: Annotated[User, Depends(get_active_user)],
    db: Annotated[Session, Depends(get_db)],
) -> UserProfile:
    updated_user = update_user_profile(db, user, update)
    return as_profile(updated_user, email_verified=True)
