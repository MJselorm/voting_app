"""add_verification_fields_to_users

Revision ID: 002_verification
Revises: 001_initial
Create Date: 2026-08-11

Adds identity verification tracking fields to the users table:
  - is_verified (BOOLEAN, default FALSE)
  - verified_at (TIMESTAMPTZ, NULLABLE)
"""
from __future__ import annotations

from alembic import op

revision = "002_verification"
down_revision = "001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        DO $$ BEGIN
            CREATE TABLE IF NOT EXISTS users (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                firebase_uid VARCHAR(128) NOT NULL,
                full_name VARCHAR(255) NOT NULL,
                email VARCHAR(320) NOT NULL,
                student_id VARCHAR(50),
                role userrole NOT NULL DEFAULT 'STUDENT',
                is_active BOOLEAN NOT NULL DEFAULT TRUE,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        END $$;

        ALTER TABLE users
            ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

        -- A pre-existing table may already have constraints with these names.
        -- PostgreSQL represents those constraints with same-named indexes, so
        -- CREATE INDEX IF NOT EXISTS safely works for both cases.
        CREATE UNIQUE INDEX IF NOT EXISTS uq_users_firebase_uid ON users(firebase_uid);
        CREATE UNIQUE INDEX IF NOT EXISTS uq_users_email ON users(email);
        CREATE UNIQUE INDEX IF NOT EXISTS uq_users_student_id ON users(student_id);

        CREATE INDEX IF NOT EXISTS ix_users_is_verified ON users(is_verified);
    """)


def downgrade() -> None:
    op.execute("""
        DROP INDEX IF EXISTS ix_users_is_verified;
        ALTER TABLE users
            DROP COLUMN IF EXISTS verified_at,
            DROP COLUMN IF EXISTS is_verified;
    """)
