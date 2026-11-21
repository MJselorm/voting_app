import smtplib

from app.core.config import Settings
from app.models.organization import NotificationDeliveryStatus
from app.services.notifications import send_email


def test_smtp_failure_is_reported_as_failed_delivery(monkeypatch):
    settings = Settings(
        database_url="",
        firebase_project_id="",
        firebase_service_account_json="",
        cors_origins=(),
        public_app_url="http://localhost:5173",
        smtp_host="smtp.example.test",
        smtp_port=587,
        smtp_username="",
        smtp_password="",
        smtp_from="noreply@example.test",
        smtp_use_tls=False,
    )
    monkeypatch.setattr("app.services.notifications.get_settings", lambda: settings)

    def unavailable_server(*args, **kwargs):
        raise smtplib.SMTPConnectError(421, b"temporarily unavailable")

    monkeypatch.setattr("app.services.notifications.smtplib.SMTP", unavailable_server)

    result = send_email("member@example.test", "Test", "Test message")

    assert result == NotificationDeliveryStatus.FAILED
