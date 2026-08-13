from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.database.session import get_db
from app.models.student import Student
from app.models.user import User
from app.schemas.user import EligibilityCheckResponse
from app.services.eligibility import check_election_eligibility

router = APIRouter(prefix="/api/eligibility", tags=["Eligibility"])


@router.post("/check", response_model=EligibilityCheckResponse)
async def check_eligibility(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> EligibilityCheckResponse:
    student = None
    if current_user.student_id:
        result = await db.execute(select(Student).where(Student.student_id == current_user.student_id))
        student = result.scalar_one_or_none()

    # Election criteria must come from an election record or backend defaults,
    # never from a browser-controlled request body.
    eligibility = check_election_eligibility(current_user, student)
    return EligibilityCheckResponse(
        is_eligible=eligibility.is_eligible,
        reason=eligibility.reason,
        user=current_user,
        student=student,
    )
