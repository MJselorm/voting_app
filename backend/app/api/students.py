from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, File, HTTPException, Query, Response, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, require_election_official
from app.database.session import get_db
from app.models.student import Student
from app.models.student_import import StudentImport
from app.models.user import User
from app.schemas.user import StudentResponse
from app.services.csv_importer import apply_preview, preview_upload

router = APIRouter(prefix="/api", tags=["Students"])
MAX_FILE_BYTES = 10 * 1024 * 1024
_previews: dict[str, dict] = {}


class ConfirmImport(BaseModel):
    preview_id: str
    existing_record_behavior: str = Field(pattern="^(update|skip)$")


class StudentUpdate(BaseModel):
    full_name: str | None = None
    email: str | None = None
    department: str | None = None
    level: str | None = None
    class_: str | None = None
    status: str | None = None


@router.get("/students/me", response_model=StudentResponse)
async def get_my_student_record(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> Student:
    if not current_user.is_verified or not current_user.student_id:
        raise HTTPException(400, "Account is not yet verified.")
    student = (await db.execute(select(Student).where(Student.student_id == current_user.student_id))).scalar_one_or_none()
    if not student:
        raise HTTPException(404, "Official student record not found.")
    return student


@router.post("/admin/students/import/preview")
async def import_preview(file: UploadFile = File(...), admin: User = Depends(require_election_official), db: AsyncSession = Depends(get_db)) -> dict:
    content = await file.read(MAX_FILE_BYTES + 1)
    if len(content) > MAX_FILE_BYTES:
        raise HTTPException(413, "File exceeds the 10 MB limit.")
    preview = await preview_upload(content, file.filename or "upload", db)
    preview_id = str(uuid.uuid4())
    _previews[preview_id] = {"user_id": str(admin.id), "expires": datetime.now(timezone.utc) + timedelta(minutes=30), "records": preview.records, "file_name": file.filename or "upload", "errors": preview.errors}
    invalid = sum(r.get("validation_status") in {"INVALID", "DUPLICATE"} for r in preview.records)
    return {"preview_id": preview_id, "file_name": file.filename, "total_rows": preview.total_rows, "valid_rows": preview.new_count + preview.existing_count, "new_students": preview.new_count, "existing_records": preview.existing_count, "invalid_rows": invalid, "errors": preview.errors, "records": preview.records}


@router.post("/admin/students/import/confirm")
async def import_confirm(payload: ConfirmImport, admin: User = Depends(require_election_official), db: AsyncSession = Depends(get_db)) -> dict:
    data = _previews.get(payload.preview_id)
    if not data or data["user_id"] != str(admin.id) or data["expires"] < datetime.now(timezone.utc):
        raise HTTPException(400, "Import preview is missing or expired. Upload the file again.")
    try:
        added, updated, skipped = await apply_preview(data["records"], payload.existing_record_behavior, db)
        failed = len(data["errors"])
        db.add(StudentImport(performed_by_user_id=admin.id, file_name=data["file_name"], added_count=added, updated_count=updated, skipped_count=skipped, failed_count=failed))
        await db.commit()
        _previews.pop(payload.preview_id, None)
    except Exception:
        await db.rollback()
        raise HTTPException(500, "Import failed; no changes were saved.")
    total = (await db.execute(select(func.count()).select_from(Student))).scalar_one()
    return {"success": True, "added": added, "updated": updated, "skipped": skipped, "failed": failed, "total_student_records": total}


@router.get("/admin/students", response_model=list[StudentResponse])
async def list_students(search: str | None = None, department: str | None = None, status_filter: str | None = Query(None, alias="status"), limit: int = Query(50, le=200), _: User = Depends(require_election_official), db: AsyncSession = Depends(get_db)) -> list[Student]:
    stmt = select(Student).order_by(Student.student_id).limit(limit)
    if search:
        stmt = stmt.where(or_(Student.student_id.ilike(f"%{search}%"), Student.full_name.ilike(f"%{search}%"), Student.email.ilike(f"%{search}%")))
    if department: stmt = stmt.where(Student.department == department)
    if status_filter: stmt = stmt.where(Student.status == status_filter.upper())
    return list((await db.execute(stmt)).scalars())


@router.put("/admin/students/{student_id}", response_model=StudentResponse)
async def update_student(student_id: str, payload: StudentUpdate, _: User = Depends(require_election_official), db: AsyncSession = Depends(get_db)) -> Student:
    student = (await db.execute(select(Student).where(Student.student_id == student_id))).scalar_one_or_none()
    if not student: raise HTTPException(404, "Student not found.")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(student, key, value)
    await db.flush()
    return student


@router.delete("/admin/students/{student_id}", status_code=204, response_class=Response, response_model=None)
async def delete_student(student_id: str, _: User = Depends(require_election_official), db: AsyncSession = Depends(get_db)) -> None:
    student = (await db.execute(select(Student).where(Student.student_id == student_id))).scalar_one_or_none()
    if not student: raise HTTPException(404, "Student not found.")
    await db.delete(student)
