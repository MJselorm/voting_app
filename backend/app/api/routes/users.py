from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.dependencies import (
    FirebaseIdentity,
    get_active_user,
    get_recently_authenticated_identity,
)
from app.database.session import get_db
from app.models.user import User
from app.schemas.user import (
    AccountDeletionResponse,
    UserProfile,
    UserProfileUpdate,
)
from app.services.users import delete_user_account, update_user_profile

router = APIRouter(prefix="/v1/users", tags=["users"])


def as_profile(user: User) -> UserProfile:
    return UserProfile(
        id=user.id,
        full_name=user.full_name,
        email=user.email,
        is_active=user.is_active,
        email_verified=True,
        is_platform_super_admin=user.is_platform_super_admin,
        created_at=user.created_at,
        updated_at=user.updated_at,
    )


@router.get("/me", response_model=UserProfile)
def get_my_profile(
    user: Annotated[User, Depends(get_active_user)],
) -> UserProfile:
    return as_profile(user)


@router.patch("/me", response_model=UserProfile)
def patch_my_profile(
    update: UserProfileUpdate,
    user: Annotated[User, Depends(get_active_user)],
    db: Annotated[Session, Depends(get_db)],
) -> UserProfile:
    return as_profile(update_user_profile(db, user, update))


@router.delete("/me", response_model=AccountDeletionResponse)
def delete_my_account(
    identity: Annotated[
        FirebaseIdentity,
        Depends(get_recently_authenticated_identity),
    ],
    user: Annotated[User, Depends(get_active_user)],
    db: Annotated[Session, Depends(get_db)],
) -> AccountDeletionResponse:
    if user.firebase_uid != identity.uid:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete your own account.",
        )
    delete_user_account(db, user)
    return AccountDeletionResponse(message="Your account was permanently deleted.")
