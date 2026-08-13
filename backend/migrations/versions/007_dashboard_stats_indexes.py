"""add indexes for exact dashboard statistics

Revision ID: 007_dashboard_stats_indexes
Revises: 006_student_import_audit
"""
from alembic import op

revision = "007_dashboard_stats_indexes"
down_revision = "006_student_import_audit"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Partial indexes keep the dashboard's student-only counts compact.
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_users_dashboard_registered_voters
        ON users (id) WHERE role = 'STUDENT' AND is_active = TRUE;
        CREATE INDEX IF NOT EXISTS ix_users_dashboard_verified_voters
        ON users (student_id) WHERE role = 'STUDENT' AND is_active = TRUE AND is_verified = TRUE;
        CREATE INDEX IF NOT EXISTS ix_students_dashboard_eligibility
        ON students (status, lower(department), student_id);
    """)


def downgrade() -> None:
    op.execute("""
        DROP INDEX IF EXISTS ix_students_dashboard_eligibility;
        DROP INDEX IF EXISTS ix_users_dashboard_verified_voters;
        DROP INDEX IF EXISTS ix_users_dashboard_registered_voters;
    """)
