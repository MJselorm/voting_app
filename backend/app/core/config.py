from __future__ import annotations

from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from pydantic_settings import BaseSettings, SettingsConfigDict


BACKEND_ROOT = Path(__file__).resolve().parents[2]
PROJECT_ROOT = BACKEND_ROOT.parent


class Settings(BaseSettings):
    """
    Application settings loaded from environment variables.
    All secrets must be set in the .env file — never hardcoded.
    """

    model_config = SettingsConfigDict(
        # Keep application/Firebase settings in backend/.env, while allowing
        # `neon deploy` to supply DATABASE_URL and Realtime credentials from
        # the repository-level .env.local file it manages.
        # Later files override earlier ones, so Neon is the DB source of truth.
        env_file=(BACKEND_ROOT / ".env", PROJECT_ROOT / ".env.local"),
        env_file_encoding="utf-8",
        case_sensitive=True,
        # Neon also writes helpful connection and branch metadata which this
        # FastAPI process does not need to parse.
        extra="ignore",
    )

    # ── Database ──────────────────────────────────────────────────────────
    DATABASE_URL: str
    # Supplied by `neon deploy` when Realtime is enabled. These remain
    # server-side and are never exposed to the Vite client.
    NEON_REALTIME_URL: str | None = None
    NEON_REALTIME_SECRET: str | None = None

    # ── Firebase Admin SDK ────────────────────────────────────────────────
    FIREBASE_PROJECT_ID: str
    FIREBASE_CLIENT_EMAIL: str
    # Private key stored with escaped newlines in .env — decoded here.
    FIREBASE_PRIVATE_KEY: str

    # ── CORS ──────────────────────────────────────────────────────────────
    ALLOWED_ORIGINS: str = "http://localhost:5173"

    # ── Student Identity / Eligibility ───────────────────────────────────
    ALLOWED_EMAIL_DOMAINS: str = ""
    EMAIL_PATTERNS: str = ""
    DEFAULT_ELIGIBLE_DEPARTMENT: str = "Computer Science and Engineering"

    # ── App ───────────────────────────────────────────────────────────────
    APP_ENV: str = "development"

    @property
    def async_database_url(self) -> str:
        """Return DATABASE_URL in the format required by SQLAlchemy async.

        Supabase's dashboard provides pooler strings with a ``postgresql://``
        scheme. The app uses asyncpg, so convert only that scheme while leaving
        credentials, host, port, database, and query parameters untouched.
        """
        parts = urlsplit(self.DATABASE_URL)
        if parts.scheme == "postgresql":
            # Neon/libpq URLs include `channel_binding=require`.  It is valid
            # for libpq (and Alembic's psycopg2) but not an asyncpg connection
            # option, so exclude it for SQLAlchemy's async driver.
            query = urlencode(
                [(key, value) for key, value in parse_qsl(parts.query, keep_blank_values=True)
                 if key not in {"channel_binding", "sslmode"}]
            )
            return urlunsplit(("postgresql+asyncpg", parts.netloc, parts.path, query, parts.fragment))
        return self.DATABASE_URL

    @property
    def neon_realtime_enabled(self) -> bool:
        """Whether Neon Realtime credentials were provisioned for this app."""
        return bool(self.NEON_REALTIME_URL and self.NEON_REALTIME_SECRET)

    @property
    def firebase_private_key_decoded(self) -> str:
        """Return the private key with literal \\n replaced by real newlines."""
        return self.FIREBASE_PRIVATE_KEY.replace("\\n", "\n")

    @property
    def cors_origins(self) -> list[str]:
        """Parse comma-separated ALLOWED_ORIGINS into a list."""
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",")]

    @property
    def allowed_email_domains(self) -> list[str]:
        return [item.strip().lower() for item in self.ALLOWED_EMAIL_DOMAINS.split(",") if item.strip()]

    @property
    def email_patterns(self) -> list[str]:
        return [item.strip() for item in self.EMAIL_PATTERNS.split(",") if item.strip()]

    @property
    def is_production(self) -> bool:
        return self.APP_ENV == "production"


settings = Settings()
