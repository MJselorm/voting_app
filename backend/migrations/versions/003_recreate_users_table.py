"""recreate_users_table_if_missing

Revision ID: 003_recreate_users
Revises: 002_verification
Create Date: 2026-08-11

Safety migration to recreate the users table if it was manually deleted.
It is idempotent and keeps the existing verification fields and uniqueness
constraints required by the authentication flow.
"""
from __future__ import annotations

from alembic import op

revision = "003_recreate_users"
down_revision = "002_verification"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE userrole AS ENUM ('STUDENT', 'ELECTION_OFFICIAL', 'SUPER_ADMIN');
        EXCEPTION
            WHEN duplicate_object THEN NULL;
        END $$;

        CREATE TABLE IF NOT EXISTS users (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            firebase_uid VARCHAR(128) NOT NULL,
            full_name VARCHAR(255) NOT NULL,
            email VARCHAR(320) NOT NULL,
            student_id VARCHAR(50),
            role userrole NOT NULL DEFAULT 'STUDENT',
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            is_verified BOOLEAN NOT NULL DEFAULT FALSE,
            verified_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        -- Do not add constraints with the uq_users_* names here: migration 002
        -- may already have created unique indexes with those names.
        CREATE UNIQUE INDEX IF NOT EXISTS uq_users_firebase_uid ON users(firebase_uid);
        CREATE UNIQUE INDEX IF NOT EXISTS uq_users_email ON users(email);
        CREATE UNIQUE INDEX IF NOT EXISTS uq_users_student_id ON users(student_id);

        CREATE INDEX IF NOT EXISTS ix_users_id ON users(id);
        CREATE INDEX IF NOT EXISTS ix_users_firebase_uid ON users(firebase_uid);
        CREATE INDEX IF NOT EXISTS ix_users_email ON users(email);
        CREATE INDEX IF NOT EXISTS ix_users_student_id ON users(student_id);
        CREATE INDEX IF NOT EXISTS ix_users_is_verified ON users(is_verified);
    """)


def downgrade() -> None:
    op.execute("""
        DROP INDEX IF EXISTS ix_users_is_verified;
        DROP INDEX IF EXISTS ix_users_student_id;
        DROP INDEX IF EXISTS ix_users_email;
        DROP INDEX IF EXISTS ix_users_firebase_uid;
        DROP INDEX IF EXISTS ix_users_id;
        DROP TABLE IF EXISTS users;
    """)
