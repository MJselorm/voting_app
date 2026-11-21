import uuid
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session
from app.auth.dependencies import get_active_user
from app.database.session import get_db
from app.models.notification import UserNotification
from app.models.user import User
from app.schemas.notification import NotificationList, NotificationResponse, NotificationUnreadCount

router = APIRouter(prefix="/v1/notifications", tags=["notifications"])

@router.get("", response_model=NotificationList)
def list_notifications(user: Annotated[User, Depends(get_active_user)], db: Annotated[Session, Depends(get_db)], unread_only: bool = False, offset: int = Query(0, ge=0), limit: int = Query(20, ge=1, le=100)):
    base = select(UserNotification).where(UserNotification.recipient_user_id == user.id)
    if unread_only: base = base.where(UserNotification.read_at.is_(None))
    total = db.scalar(select(func.count()).select_from(base.subquery())) or 0
    items = db.scalars(base.order_by(UserNotification.created_at.desc()).offset(offset).limit(limit)).all()
    return NotificationList(items=items, total=total)

@router.get("/unread-count", response_model=NotificationUnreadCount)
def unread_count(user: Annotated[User, Depends(get_active_user)], db: Annotated[Session, Depends(get_db)]):
    return NotificationUnreadCount(count=db.scalar(select(func.count()).select_from(UserNotification).where(UserNotification.recipient_user_id == user.id, UserNotification.read_at.is_(None))) or 0)

@router.patch("/{notification_id}/read", response_model=NotificationResponse)
def mark_read(notification_id: uuid.UUID, user: Annotated[User, Depends(get_active_user)], db: Annotated[Session, Depends(get_db)]):
    item = db.scalar(select(UserNotification).where(UserNotification.id == notification_id, UserNotification.recipient_user_id == user.id))
    if item is None: raise HTTPException(status_code=404, detail="Notification not found.")
    if item.read_at is None:
        from datetime import datetime, timezone
        item.read_at = datetime.now(timezone.utc); db.commit(); db.refresh(item)
    return item

@router.post("/mark-all-read", status_code=status.HTTP_204_NO_CONTENT)
def mark_all_read(user: Annotated[User, Depends(get_active_user)], db: Annotated[Session, Depends(get_db)]):
    from datetime import datetime, timezone
    db.execute(update(UserNotification).where(UserNotification.recipient_user_id == user.id, UserNotification.read_at.is_(None)).values(read_at=datetime.now(timezone.utc))); db.commit()
