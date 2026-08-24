"""ensure election audit logs table and columns

Revision ID: 009_ensure_election_audit_logs
Revises: 008_election_configuration
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "009_ensure_election_audit_logs"
down_revision = "008_election_configuration"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        DO $$ BEGIN
            ALTER TYPE electionstatus ADD VALUE IF NOT EXISTS 'OFFICIAL_REVIEW';
        EXCEPTION WHEN OTHERS THEN null;
        END $$;

        DO $$ BEGIN
            ALTER TYPE electionstatus ADD VALUE IF NOT EXISTS 'SUPER_ADMIN_FINAL_APPROVAL';
        EXCEPTION WHEN OTHERS THEN null;
        END $$;

        DO $$ BEGIN
            ALTER TYPE electionstatus ADD VALUE IF NOT EXISTS 'CANCELLED';
        EXCEPTION WHEN OTHERS THEN null;
        END $$;

        DO $$ BEGIN
            ALTER TABLE election_approvals ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
        EXCEPTION WHEN OTHERS THEN null;
        END $$;

        CREATE TABLE IF NOT EXISTS election_audit_logs (
            id UUID PRIMARY KEY,
            election_id UUID NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
            user_id UUID REFERENCES users(id) ON DELETE SET NULL,
            action VARCHAR(100) NOT NULL,
            details JSONB,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS ix_election_audit_logs_id ON election_audit_logs(id);
        CREATE INDEX IF NOT EXISTS ix_election_audit_logs_election_id ON election_audit_logs(election_id);
        CREATE INDEX IF NOT EXISTS ix_election_audit_logs_user_id ON election_audit_logs(user_id);
        CREATE INDEX IF NOT EXISTS ix_election_audit_logs_action ON election_audit_logs(action);
        CREATE INDEX IF NOT EXISTS ix_election_audit_logs_created_at ON election_audit_logs(created_at);
    """)


def downgrade() -> None:
    op.execute("""
        DROP TABLE IF EXISTS election_audit_logs CASCADE;
    """)
