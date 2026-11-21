import uuid
from datetime import datetime
from enum import Enum

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, JSON, String, Text, UniqueConstraint, Uuid, func, text
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base


class NotificationChannel(str, Enum):
    IN_APP = "IN_APP"


class NotificationDeliveryStatus(str, Enum):
    DELIVERED = "DELIVERED"
    FAILED = "FAILED"


class UserNotification(Base):
    __tablename__ = "user_notifications"
    __table_args__ = (
        UniqueConstraint("recipient_user_id", "event_id", name="uq_notification_recipient_event"),
        Index("ix_notification_recipient_created", "recipient_user_id", "created_at"),
        Index("ix_notification_recipient_unread", "recipient_user_id", "read_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    recipient_user_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    event_id: Mapped[str] = mapped_column(String(160), nullable=False)
    event_key: Mapped[str] = mapped_column(String(120), nullable=False)
    category: Mapped[str] = mapped_column(String(60), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    action_url: Mapped[str | None] = mapped_column(String(500))
    resource_type: Mapped[str | None] = mapped_column(String(80))
    resource_id: Mapped[str | None] = mapped_column(String(80))
    payload: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict, server_default=text("'{}'"))
    channel: Mapped[NotificationChannel] = mapped_column(String(20), nullable=False, default=NotificationChannel.IN_APP.value)
    delivery_status: Mapped[NotificationDeliveryStatus] = mapped_column(String(20), nullable=False, default=NotificationDeliveryStatus.DELIVERED.value)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
