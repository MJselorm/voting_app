from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.student import Student


async def find_student_by_id(db: AsyncSession, student_id: str | None) -> Student | None:
    """Look up an official student record without exposing it to the client."""
    if not student_id:
        return None
    result = await db.execute(select(Student).where(Student.student_id == student_id))
    return result.scalar_one_or_none()


def student_is_active(student: Student | None) -> bool:
    """Only an explicitly active official record can pass identity verification."""
    return student is not None and student.status.strip().upper() == "ACTIVE"
