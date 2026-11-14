# STUDENT_IMPORT.md — Official Student Roster Ingestion Guide

## 1. Overview

UniVote allows election officials and administrators to upload official university student rosters using `.csv` or `.xlsx` files. This populates the authoritative `students` table used for identity verification and voter eligibility checks.

## 2. File Format & Schema Requirements

The uploaded file must contain a header row with the following required columns (case-insensitive and whitespace-tolerant):

| Required Header | Alternate Formats | Target Field | Example Value |
|---|---|---|---|
| `student_id` | `Student ID`, `STUDENT_ID` | `students.student_id` | `10987654` |
| `full_name` | `Full Name`, `FULL_NAME` | `students.full_name` | `Kofi Mensah` |
| `email` | `Email`, `EMAIL` | `students.email` | `kmensah@st.ug.edu.gh` |
| `department` | `Department` | `students.department` | `Computer Science and Engineering` |
| `level` | `Level` | `students.level` | `300` |
| `class` | `Class` | `students.class` | `Level 300 CE` |
| `status` | `Status` | `students.status` | `ACTIVE` |

## 3. Two-Phase Ingestion Workflow

```mermaid
sequenceDiagram
    actor Admin as Staff User
    participant UI as StudentManagementPage.tsx
    participant API as api/students.py
    participant Importer as services/csv_importer.py
    participant DB as PostgreSQL

    Admin->>UI: Selects .csv / .xlsx file
    UI->>API: POST /api/admin/students/import/preview (File)
    API->>Importer: parse_upload(content, filename)
    Importer->>Importer: Validate headers & row syntax
    Importer->>DB: Check student_id against existing table
    Importer-->>API: Returns Preview (new, existing, invalid count)
    API-->>UI: Displays Preview modal with table summary
    Admin->>UI: Selects conflict behavior ('update' or 'skip') and clicks Confirm
    UI->>API: POST /api/admin/students/import/confirm (preview_id, behavior)
    API->>DB: Batch insert / update student rows
    API->>DB: Insert student_imports audit record
    API-->>UI: Success notification & roster refresh
```

## 4. Conflict Handling & Audit Logging

- **`update`**: Updates existing students' academic records (`department`, `level`, `class`, `status`, `full_name`).
- **`skip`**: Leaves existing student records unchanged, inserting only new entries.
- **Audit Logging**: Every confirmed import records a row in `student_imports` tracking:
  - Performing staff user ID (`performed_by_user_id`).
  - Source filename (`file_name`).
  - Counts: `added_count`, `updated_count`, `skipped_count`, `failed_count`.
