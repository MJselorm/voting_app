import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.auth.dependencies import get_firebase_claims
from app.database.base import Base
from app.database.session import get_db
from app.main import app
from tests.factories import VALID_CLAIMS


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch):
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    test_session_factory = sessionmaker(
        bind=engine,
        autoflush=False,
        expire_on_commit=False,
    )

    def override_get_db():
        db = test_session_factory()
        try:
            yield db
        finally:
            db.close()

    monkeypatch.setattr("app.main.initialize_firebase", lambda: None)
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_firebase_claims] = lambda: dict(VALID_CLAIMS)
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
    Base.metadata.drop_all(engine)
    engine.dispose()
