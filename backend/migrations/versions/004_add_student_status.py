"""add official student status

Revision ID: 004_student_status
Revises: 003_recreate_users
"""
from __future__ import annotations

from alembic import op

revision = "004_student_status"
down_revision = "003_recreate_users"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE students
            ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE';

        UPDATE students
        SET status = 'ACTIVE'
        WHERE status IS NULL OR BTRIM(status) = '';

        CREATE INDEX IF NOT EXISTS ix_students_status ON students(status);
    """)


def downgrade() -> None:
    op.execute("""
        DROP INDEX IF EXISTS ix_students_status;
        ALTER TABLE students DROP COLUMN IF EXISTS status;
    """)
