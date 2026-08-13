"""add student import audit log

Revision ID: 006_student_import_audit
Revises: 005_recreate_core_tables
"""
from alembic import op

revision = "006_student_import_audit"
down_revision = "005_recreate_core_tables"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS student_imports (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            performed_by_user_id UUID NOT NULL,
            file_name VARCHAR(255) NOT NULL,
            added_count INTEGER NOT NULL DEFAULT 0,
            updated_count INTEGER NOT NULL DEFAULT 0,
            skipped_count INTEGER NOT NULL DEFAULT 0,
            failed_count INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS ix_student_imports_performed_by_user_id ON student_imports(performed_by_user_id);
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS student_imports;")
