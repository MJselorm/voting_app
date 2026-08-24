"""create election creation and configuration tables

Revision ID: 008_election_configuration
Revises: 007_dashboard_stats_indexes
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "008_election_configuration"
down_revision = "007_dashboard_stats_indexes"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Enums ─────────────────────────────────────────────────────────────
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE electionstatus AS ENUM (
                'DRAFT',
                'PENDING_APPROVAL',
                'OFFICIAL_REVIEW',
                'SUPER_ADMIN_FINAL_APPROVAL',
                'APPROVED',
                'SCHEDULED',
                'LIVE',
                'ENDED',
                'CANCELLED'
            );
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;

        DO $$ BEGIN
            CREATE TYPE resultvisibility AS ENUM (
                'HIDDEN_UNTIL_ENDED',
                'OFFICIALS_ONLY_DURING_VOTING',
                'PUBLIC_LIVE'
            );
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)

    # ── Table: elections ──────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS elections (
            id UUID PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            description TEXT,
            department VARCHAR(150) NOT NULL DEFAULT 'Computer Science and Engineering',
            election_type VARCHAR(100) NOT NULL DEFAULT 'Departmental Election',
            start_at TIMESTAMPTZ,
            end_at TIMESTAMPTZ,
            status electionstatus NOT NULL DEFAULT 'DRAFT',
            result_visibility resultvisibility NOT NULL DEFAULT 'OFFICIALS_ONLY_DURING_VOTING',
            eligibility_criteria JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS ix_elections_id ON elections(id);
        CREATE INDEX IF NOT EXISTS ix_elections_status ON elections(status);
        CREATE INDEX IF NOT EXISTS ix_elections_department ON elections(department);
        CREATE INDEX IF NOT EXISTS ix_elections_created_by ON elections(created_by);
    """)

    # ── Table: election_positions ─────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS election_positions (
            id UUID PRIMARY KEY,
            election_id UUID NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
            name VARCHAR(150) NOT NULL,
            description TEXT,
            display_order INTEGER NOT NULL DEFAULT 0,
            number_of_winners INTEGER NOT NULL DEFAULT 1,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS ix_election_positions_id ON election_positions(id);
        CREATE INDEX IF NOT EXISTS ix_election_positions_election_id ON election_positions(election_id);
    """)

    # ── Table: election_official_assignments ──────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS election_official_assignments (
            id UUID PRIMARY KEY,
            election_id UUID NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT uq_election_official_assignment UNIQUE (election_id, user_id)
        );
        CREATE INDEX IF NOT EXISTS ix_election_official_assignments_id ON election_official_assignments(id);
        CREATE INDEX IF NOT EXISTS ix_election_official_assignments_election_id ON election_official_assignments(election_id);
        CREATE INDEX IF NOT EXISTS ix_election_official_assignments_user_id ON election_official_assignments(user_id);
    """)

    # ── Table: election_approvals ─────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS election_approvals (
            id UUID PRIMARY KEY,
            election_id UUID NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            approval_status VARCHAR(50) NOT NULL,
            comment TEXT,
            approved_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS ix_election_approvals_id ON election_approvals(id);
        CREATE INDEX IF NOT EXISTS ix_election_approvals_election_id ON election_approvals(election_id);
        CREATE INDEX IF NOT EXISTS ix_election_approvals_user_id ON election_approvals(user_id);
    """)

    # ── Table: election_audit_logs ────────────────────────────────────────
    op.execute("""
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
        DROP TABLE IF EXISTS election_approvals CASCADE;
        DROP TABLE IF EXISTS election_official_assignments CASCADE;
        DROP TABLE IF EXISTS election_positions CASCADE;
        DROP TABLE IF EXISTS elections CASCADE;
        DROP TYPE IF EXISTS resultvisibility;
        DROP TYPE IF EXISTS electionstatus;
    """)
