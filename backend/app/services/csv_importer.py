from __future__ import annotations

import csv
import io
from typing import Any, NamedTuple

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.student import Student


class ImportResult(NamedTuple):
    total_processed: int
    created_count: int
    updated_count: int
    errors: list[str]


def parse_and_validate_csv(csv_content: str) -> tuple[list[dict[str, str]], list[str]]:
    """
    Parse CSV content and validate required structure and content.

    Required columns:
        - student_id
        - full_name
        - email
        - department
        - level
        - class
        - status (ACTIVE or INACTIVE)

    Validates:
        - Required header existence
        - Duplicate student_id inside the CSV file
        - Duplicate email inside the CSV file
        - Non-empty values for required fields
    """
    errors: list[str] = []
    records: list[dict[str, str]] = []

    reader = csv.DictReader(io.StringIO(csv_content))
    if not reader.fieldnames:
        return [], ["CSV file is empty or missing headers."]

    normalized_headers = [h.strip().lower() for h in reader.fieldnames if h]
    required_fields = {"student_id", "full_name", "email", "department", "level", "class", "status"}

    missing_fields = required_fields - set(normalized_headers)
    if missing_fields:
        return [], [f"CSV missing required columns: {', '.join(sorted(missing_fields))}"]

    seen_student_ids: set[str] = set()
    seen_emails: set[str] = set()

    for row_idx, raw_row in enumerate(reader, start=2):  # Row 1 is header
        row = {k.strip().lower(): (v or "").strip() for k, v in raw_row.items() if k}

        sid = row.get("student_id", "")
        name = row.get("full_name", "")
        email = row.get("email", "").lower()
        dept = row.get("department", "")
        student_status = row.get("status", "").upper()

        if not sid:
            errors.append(f"Row {row_idx}: Missing required 'student_id'.")
        elif sid.lower() in seen_student_ids:
            errors.append(f"Row {row_idx}: Duplicate student_id '{sid}' in CSV.")
        else:
            seen_student_ids.add(sid.lower())

        if not name:
            errors.append(f"Row {row_idx}: Missing required 'full_name'.")

        if not email:
            errors.append(f"Row {row_idx}: Missing required 'email'.")
        elif email in seen_emails:
            errors.append(f"Row {row_idx}: Duplicate email '{email}' in CSV.")
        else:
            seen_emails.add(email)

        if not dept:
            errors.append(f"Row {row_idx}: Missing required 'department'.")
        if not row.get("level", ""):
            errors.append(f"Row {row_idx}: Missing required 'level'.")
        if not row.get("class", ""):
            errors.append(f"Row {row_idx}: Missing required 'class'.")
        if student_status not in {"ACTIVE", "INACTIVE"}:
            errors.append(f"Row {row_idx}: 'status' must be ACTIVE or INACTIVE.")

        records.append({
            "student_id": sid,
            "full_name": name,
            "email": email,
            "department": dept,
            "level": row.get("level", ""),
            "class": row.get("class", ""),
            "status": student_status,
        })

    return records, errors


async def import_students_from_csv(csv_content: str, db: AsyncSession) -> ImportResult:
    """
    Import official student roster from CSV content.
    Atomic operation: if any validation error occurs, no records are saved.
    """
    records, errors = parse_and_validate_csv(csv_content)
    if errors:
        return ImportResult(0, 0, 0, errors)

    created_count = 0
    updated_count = 0

    existing_emails: set[str] = set()
    for rec in records:
        if rec["email"] in existing_emails:
            errors.append(f"Duplicate email '{rec['email']}' in import batch.")
        existing_emails.add(rec["email"])
        sid = rec["student_id"]
        result = await db.execute(select(Student).where(Student.student_id == sid))
        existing_student = result.scalar_one_or_none()

        if existing_student:
            existing_student.full_name = rec["full_name"]
            existing_student.email = rec["email"]
            existing_student.department = rec["department"]
            existing_student.level = rec["level"] or None
            existing_student.class_ = rec["class"] or None
            existing_student.status = rec["status"]
            updated_count += 1
        else:
            new_student = Student(
                student_id=rec["student_id"],
                full_name=rec["full_name"],
                email=rec["email"],
                department=rec["department"],
                level=rec["level"] or None,
                class_=rec["class"] or None,
                status=rec["status"],
            )
            db.add(new_student)
            created_count += 1

    if errors:
        await db.rollback()
        return ImportResult(0, 0, 0, errors)
    await db.flush()
    return ImportResult(
        total_processed=len(records),
        created_count=created_count,
        updated_count=updated_count,
        errors=[],
    )
