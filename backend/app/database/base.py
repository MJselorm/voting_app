from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Single shared Base for all SQLAlchemy models."""
    pass

