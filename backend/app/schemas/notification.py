import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict

class NotificationResponse(BaseModel):
    id: uuid.UUID
    event_key: str
    category: str
    title: str
    body: str
    action_url: str | None
    resource_type: str | None
    resource_id: str | None
    read_at: datetime | None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class NotificationList(BaseModel):
    items: list[NotificationResponse]
    total: int

class NotificationUnreadCount(BaseModel):
    count: int
