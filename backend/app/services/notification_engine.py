"""Shared in-app notification event registry and delivery engine."""
from dataclasses import dataclass
from html import escape
from typing import Any
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from app.models.notification import UserNotification

@dataclass(frozen=True)
class EventDefinition:
    key: str; category: str; title: str; body: str; action_url: str
    required: frozenset[str]

EVENTS = {
    "organisation.request.approved": EventDefinition("organisation.request.approved", "organisation", "Organisation Request Approved", "Your request to create {{organisation_name}} has been approved.", "/app/organizations/mine", frozenset({"organisation_name"})),
    "organisation.request.rejected": EventDefinition("organisation.request.rejected", "organisation", "Organisation Request Rejected", "Your request to create {{organisation_name}} was rejected. Reason: {{rejection_reason}}.", "/app/organizations/requests", frozenset({"organisation_name", "rejection_reason"})),
}

def _render(template: str, payload: dict[str, Any]) -> str:
    for key, value in payload.items(): template = template.replace("{{" + key + "}}", escape(str(value)))
    return template

def publish(db: Session, *, event_id: str, event_key: str, recipient_user_id: Any, payload: dict[str, Any], resource_type: str | None = None, resource_id: str | None = None) -> UserNotification | None:
    event = EVENTS.get(event_key)
    if event is None: raise ValueError(f"Unknown notification event: {event_key}")
    missing = event.required - payload.keys()
    if missing: raise ValueError(f"Missing notification payload fields: {', '.join(sorted(missing))}")
    record = UserNotification(recipient_user_id=recipient_user_id, event_id=event_id, event_key=event.key, category=event.category, title=_render(event.title, payload), body=_render(event.body, payload), action_url=event.action_url, resource_type=resource_type, resource_id=resource_id, payload=payload)
    db.add(record)
    try:
        db.flush()
        return record
    except IntegrityError:
        db.rollback()
        return None
