from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, require_election_official
from app.database.session import get_db
from app.models.student import Student
from app.models.user import User
from app.schemas.user import StudentResponse
from app.services.csv_importer import import_students_from_csv

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/students", tags=["Students"])


# ── GET /api/students/me ──────────────────────────────────────────────────────

@router.get(
    "/me",
    response_model=StudentResponse,
    summary="Get authenticated student's official record",
    description="Returns official student information (department, level, class) for verified users.",
)
async def get_my_student_record(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> StudentResponse:
    """
    Protected endpoint — returns official student record linked to the user.
    """
    if not current_user.is_verified or not current_user.student_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Account is not yet verified. Please verify your student information first.",
        )

    res = await db.execute(select(Student).where(Student.student_id == current_user.student_id))
    student = res.scalar_one_or_none()

    if student is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Official student record not found.",
        )

    return student


# ── POST /api/admin/students/import ──────────────────────────────────────────

@router.post(
    "/admin/import",
    summary="Import official student roster from CSV file",
    description="Upload a CSV file containing official student records. Restricted to Election Officials and Admins.",
)
async def import_students_csv(
    file: UploadFile = File(...),
    admin_user: User = Depends(require_election_official),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Admin endpoint — bulk uploads student records from CSV.
    Uses atomic transaction to ensure no invalid rows are committed.
    """
    if not file.filename.endswith(".csv"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only CSV files are allowed.",
        )

    content_bytes = await file.read()
    try:
        csv_text = content_bytes.decode("utf-8")
    except UnicodeDecodeError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid CSV encoding. Please upload UTF-8 formatted CSV.",
        )

    result = await import_students_from_csv(csv_text, db)
    if result.errors:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"message": "CSV validation failed", "errors": result.errors},
        )

    logger.info(
        "Admin user id=%s imported %d student records (created=%d, updated=%d)",
        admin_user.id,
        result.total_processed,
        result.created_count,
        result.updated_count,
    )

    return {
        "success": True,
        "message": f"Imported {result.total_processed} student records successfully.",
        "created_count": result.created_count,
        "updated_count": result.updated_count,
    }
