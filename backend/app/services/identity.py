from __future__ import annotations

import re
from app.core.config import settings


def normalize_name(name: str | None) -> str:
    """
    Normalize a full name for accurate, isolated identity comparison.

    Rules:
        - Return empty string if input is None or whitespace-only.
        - Strip leading and trailing whitespace.
        - Collapse consecutive spaces, tabs, or newlines into a single space.
        - Convert to lowercase.

    Examples:
        "  John   Mensah  " -> "john mensah"
        "JOHN MENSAH" -> "john mensah"
    """
    if not name:
        return ""
    trimmed = name.strip()
    collapsed = re.sub(r"\s+", " ", trimmed)
    return collapsed.lower()


def names_match(name1: str | None, name2: str | None) -> bool:
    """
    Determine if two full names match after normalization.
    Returns False if either name is missing or empty after normalization.
    """
    norm1 = normalize_name(name1)
    norm2 = normalize_name(name2)
    if not norm1 or not norm2:
        return False
    return norm1 == norm2


def verify_email_match(email1: str | None, email2: str | None) -> bool:
    """
    Verify that a registration email matches the official email on the student's record.

    Rules:
        - Trim leading/trailing whitespace.
        - Case-insensitive comparison.
    """
    if not email1 or not email2:
        return False
    return email1.strip().lower() == email2.strip().lower()


def email_is_allowed(email: str | None) -> bool:
    if not email:
        return False
    normalized = email.strip().lower()
    if settings.allowed_email_domains:
        domain = normalized.rsplit("@", 1)[-1] if "@" in normalized else ""
        if domain not in settings.allowed_email_domains:
            return False
    if settings.email_patterns:
        return any(re.fullmatch(pattern, normalized) for pattern in settings.email_patterns)
    return True
