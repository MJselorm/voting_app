"""create_users_and_students_tables

Revision ID: 001_initial
Revises:
Create Date: 2026-08-08

Creates the foundation tables for the university voting authentication system:
  - users      (linked to Firebase Authentication)
  - students   (official student records — populated via CSV in Phase 2)

Written as pure SQL to avoid SQLAlchemy Enum type conflicts with
pre-existing types in Supabase/PostgreSQL.
"""
from __future__ import annotations

from alembic import op

revision = "001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        -- ── UserRole enum (idempotent) ────────────────────────────────────
        DO $$ BEGIN
            CREATE TYPE userrole AS ENUM ('STUDENT', 'ELECTION_OFFICIAL', 'SUPER_ADMIN');
        EXCEPTION
            WHEN duplicate_object THEN NULL;
        END $$;

        -- ── users table ───────────────────────────────────────────────────
        CREATE TABLE IF NOT EXISTS users (
            id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
            firebase_uid VARCHAR(128) NOT NULL,
            full_name   VARCHAR(255) NOT NULL,
            email       VARCHAR(320) NOT NULL,
            student_id  VARCHAR(50),
            role        userrole    NOT NULL DEFAULT 'STUDENT',
            is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
            created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        -- Unique constraints
        ALTER TABLE users
            DROP CONSTRAINT IF EXISTS uq_users_firebase_uid,
            DROP CONSTRAINT IF EXISTS uq_users_email,
            DROP CONSTRAINT IF EXISTS uq_users_student_id;

        ALTER TABLE users
            ADD CONSTRAINT uq_users_firebase_uid UNIQUE (firebase_uid),
            ADD CONSTRAINT uq_users_email        UNIQUE (email),
            ADD CONSTRAINT uq_users_student_id   UNIQUE (student_id);

        -- Indexes
        CREATE INDEX IF NOT EXISTS ix_users_id          ON users(id);
        CREATE INDEX IF NOT EXISTS ix_users_firebase_uid ON users(firebase_uid);
        CREATE INDEX IF NOT EXISTS ix_users_email       ON users(email);
        CREATE INDEX IF NOT EXISTS ix_users_student_id  ON users(student_id);

        -- ── students table ────────────────────────────────────────────────
        CREATE TABLE IF NOT EXISTS students (
            id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
            student_id  VARCHAR(50) NOT NULL,
            full_name   VARCHAR(255),
            email       VARCHAR(320),
            department  VARCHAR(255),
            level       VARCHAR(50),
            class       VARCHAR(100),
            created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        -- Unique constraints
        ALTER TABLE students
            DROP CONSTRAINT IF EXISTS uq_students_student_id,
            DROP CONSTRAINT IF EXISTS uq_students_email;

        ALTER TABLE students
            ADD CONSTRAINT uq_students_student_id UNIQUE (student_id),
            ADD CONSTRAINT uq_students_email      UNIQUE (email);

        -- Indexes
        CREATE INDEX IF NOT EXISTS ix_students_id         ON students(id);
        CREATE INDEX IF NOT EXISTS ix_students_student_id ON students(student_id);
        CREATE INDEX IF NOT EXISTS ix_students_email      ON students(email);
    """)


def downgrade() -> None:
    op.execute("""
        DROP TABLE IF EXISTS students;
        DROP TABLE IF EXISTS users;
        DROP TYPE  IF EXISTS userrole;
    """)
