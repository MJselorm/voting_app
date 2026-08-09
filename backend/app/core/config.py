from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Application settings loaded from environment variables.
    All secrets must be set in the .env file — never hardcoded.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
    )

    # ── Database ──────────────────────────────────────────────────────────
    DATABASE_URL: str

    # ── Firebase Admin SDK ────────────────────────────────────────────────
    FIREBASE_PROJECT_ID: str
    FIREBASE_CLIENT_EMAIL: str
    # Private key stored with escaped newlines in .env — decoded here.
    FIREBASE_PRIVATE_KEY: str

    # ── CORS ──────────────────────────────────────────────────────────────
    ALLOWED_ORIGINS: str = "http://localhost:5173"

    # ── App ───────────────────────────────────────────────────────────────
    APP_ENV: str = "development"

    @property
    def firebase_private_key_decoded(self) -> str:
        """Return the private key with literal \\n replaced by real newlines."""
        return self.FIREBASE_PRIVATE_KEY.replace("\\n", "\n")

    @property
    def cors_origins(self) -> list[str]:
        """Parse comma-separated ALLOWED_ORIGINS into a list."""
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",")]

    @property
    def is_production(self) -> bool:
        return self.APP_ENV == "production"


settings = Settings()
