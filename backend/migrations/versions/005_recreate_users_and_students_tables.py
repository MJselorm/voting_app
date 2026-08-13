"""recreate users and students tables if missing

Revision ID: 005_recreate_core_tables
Revises: 004_student_status

Ensures the current schema can be restored after either core table has been
manually deleted. Existing tables and their data are left unchanged.
"""
from __future__ import annotations

from alembic import op


revision = "005_recreate_core_tables"
down_revision = "004_student_status"
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

        CREATE UNIQUE INDEX IF NOT EXISTS uq_users_firebase_uid ON users(firebase_uid);
        CREATE UNIQUE INDEX IF NOT EXISTS uq_users_email ON users(email);
        CREATE UNIQUE INDEX IF NOT EXISTS uq_users_student_id ON users(student_id);
        CREATE INDEX IF NOT EXISTS ix_users_id ON users(id);
        CREATE INDEX IF NOT EXISTS ix_users_firebase_uid ON users(firebase_uid);
        CREATE INDEX IF NOT EXISTS ix_users_email ON users(email);
        CREATE INDEX IF NOT EXISTS ix_users_student_id ON users(student_id);
        CREATE INDEX IF NOT EXISTS ix_users_is_verified ON users(is_verified);

        CREATE TABLE IF NOT EXISTS students (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            student_id VARCHAR(50) NOT NULL,
            full_name VARCHAR(255),
            email VARCHAR(320),
            department VARCHAR(255),
            level VARCHAR(50),
            class VARCHAR(100),
            status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE UNIQUE INDEX IF NOT EXISTS uq_students_student_id ON students(student_id);
        CREATE UNIQUE INDEX IF NOT EXISTS uq_students_email ON students(email);
        CREATE INDEX IF NOT EXISTS ix_students_id ON students(id);
        CREATE INDEX IF NOT EXISTS ix_students_student_id ON students(student_id);
        CREATE INDEX IF NOT EXISTS ix_students_email ON students(email);
        CREATE INDEX IF NOT EXISTS ix_students_status ON students(status);
    """)


def downgrade() -> None:
    # This repair migration deliberately has no destructive downgrade: it may
    # have restored tables containing newly entered production data.
    pass
