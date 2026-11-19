from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.auth.dependencies import FirebaseIdentity
from app.auth.firebase import delete_firebase_user
from app.models.organization import Organization, OrganizationManagementAssignment
from app.models.user import User
from app.schemas.user import UserProfileUpdate


def sync_user(db: Session, identity: FirebaseIdentity) -> User:
    email = identity.email.strip().lower()
    name = identity.full_name or email.partition("@")[0]
    name = " ".join(name.split())
    if len(name) < 2 or len(name) > 120:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A valid full name is required in your Firebase profile.",
        )

    user = db.scalar(select(User).where(User.firebase_uid == identity.uid))
    if user is not None:
        email_owner = db.scalar(select(User).where(User.email == email))
        if email_owner is not None and email_owner.id != user.id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This email address is already associated with another account.",
            )
        user.email = email
        try:
            db.commit()
        except IntegrityError as error:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This account could not be synchronized.",
            ) from error
        db.refresh(user)
        return user

    email_owner = db.scalar(select(User).where(User.email == email))
    if email_owner is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This email address is already associated with another account.",
        )

    user = User(
        firebase_uid=identity.uid,
        email=email,
        full_name=name,
        is_active=True,
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        existing = db.scalar(select(User).where(User.firebase_uid == identity.uid))
        if existing is not None:
            return existing
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This email address is already associated with another account.",
        ) from error
    db.refresh(user)
    return user


def update_user_profile(
    db: Session,
    user: User,
    update: UserProfileUpdate,
) -> User:
    user.full_name = update.full_name
    db.commit()
    db.refresh(user)
    return user


def delete_user_account(db: Session, user: User) -> None:
    has_created_organizations = db.scalar(
        select(Organization.id)
        .where(Organization.created_by == user.id)
        .limit(1)
    ) is not None
    has_management_assignments = db.scalar(
        select(OrganizationManagementAssignment.id)
        .where(OrganizationManagementAssignment.user_id == user.id)
        .limit(1)
    ) is not None
    if has_created_organizations or has_management_assignments:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "This account is referenced by organisation creation or management "
                "records. Transfer those references before deleting the account."
            ),
        )

    was_active = user.is_active
    user.is_active = False
    try:
        db.commit()
    except SQLAlchemyError as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The account could not be prepared for deletion. The Firebase account was not changed.",
        ) from error

    try:
        delete_firebase_user(user.firebase_uid)
    except HTTPException as deletion_error:
        user.is_active = was_active
        try:
            db.commit()
        except SQLAlchemyError as restore_error:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=(
                    "Firebase account deletion failed and the application profile "
                    "could not be reactivated. Contact support."
                ),
            ) from restore_error
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=(
                "Firebase account deletion failed. The application profile was "
                "reactivated and no deletion was completed."
            ),
        ) from deletion_error

    try:
        db.delete(user)
        db.commit()
    except SQLAlchemyError as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "The Firebase account was deleted, but the inactive Neon profile "
                "could not be removed. Contact support."
            ),
        ) from error
