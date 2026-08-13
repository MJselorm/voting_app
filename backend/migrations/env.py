"""
Alembic migration environment.

Configured to:
  - Read DATABASE_URL from .env via app settings (not alembic.ini)
  - Use psycopg2 (sync) for migrations (asyncpg is for runtime only)
  - Auto-detect model changes via SQLAlchemy metadata
"""
from __future__ import annotations

import os
import sys
from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool
from alembic import context

# ── Path setup ────────────────────────────────────────────────────────────────
# Add the backend root to sys.path so we can import app modules.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# ── Load app settings & models ────────────────────────────────────────────────
from app.core.config import settings
from app.database.base import Base  # noqa: F401
import app.models.user   # noqa: F401 — registers User model with Base
import app.models.student  # noqa: F401 — registers Student model with Base
import app.models.student_import  # noqa: F401 — registers StudentImport model with Base

# ── Alembic Config ────────────────────────────────────────────────────────────
alembic_config = context.config

# Logging
if alembic_config.config_file_name is not None:
    fileConfig(alembic_config.config_file_name)

# Use our metadata for autogenerate support
target_metadata = Base.metadata

# Override the sqlalchemy.url from alembic.ini with our env-based DATABASE_URL.
# Convert asyncpg URL → psycopg2 URL for Alembic (migrations run synchronously).
_url = settings.async_database_url.replace("postgresql+asyncpg://", "postgresql+psycopg2://")
alembic_config.set_main_option("sqlalchemy.url", _url)


# ── Migration runners ─────────────────────────────────────────────────────────

def run_migrations_offline() -> None:
    """Run migrations without a live DB connection (generates SQL script)."""
    url = alembic_config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations against a live database connection."""
    connectable = engine_from_config(
        alembic_config.get_section(alembic_config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
