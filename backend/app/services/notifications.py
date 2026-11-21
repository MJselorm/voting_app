import logging
import smtplib
import ssl
from email.message import EmailMessage
from collections.abc import Iterable

from app.core.config import get_settings
from app.models.organization import NotificationDeliveryStatus

logger = logging.getLogger(__name__)


def send_email(
    recipient: str,
    subject: str,
    body: str,
) -> NotificationDeliveryStatus:
    settings = get_settings()
    if not settings.smtp_host or not settings.smtp_from:
        logger.warning("Membership notification not sent: SMTP is not configured.")
        return NotificationDeliveryStatus.NOT_CONFIGURED
    if bool(settings.smtp_username) != bool(settings.smtp_password):
        logger.error("Membership notification not sent: SMTP credentials are incomplete.")
        return NotificationDeliveryStatus.FAILED

    message = EmailMessage()
    message["From"] = settings.smtp_from
    message["To"] = recipient
    message["Subject"] = subject
    message.set_content(body)

    try:
        with smtplib.SMTP(
            settings.smtp_host,
            settings.smtp_port,
            timeout=10,
        ) as client:
            if settings.smtp_use_tls:
                client.starttls(context=ssl.create_default_context())
            if settings.smtp_username:
                client.login(settings.smtp_username, settings.smtp_password)
            client.send_message(message)
    except (OSError, smtplib.SMTPException):
        logger.exception("Membership notification delivery failed.")
        return NotificationDeliveryStatus.FAILED

    return NotificationDeliveryStatus.SENT


def send_email_to_many(
    recipients: Iterable[str],
    subject: str,
    body: str,
) -> NotificationDeliveryStatus:
    unique_recipients = sorted({email.strip().lower() for email in recipients if email.strip()})
    if not unique_recipients:
        return NotificationDeliveryStatus.NO_RECIPIENT

    results = [
        send_email(recipient, subject, body)
        for recipient in unique_recipients
    ]
    if all(result == NotificationDeliveryStatus.SENT for result in results):
        return NotificationDeliveryStatus.SENT
    if any(result == NotificationDeliveryStatus.FAILED for result in results):
        return NotificationDeliveryStatus.FAILED
    return NotificationDeliveryStatus.NOT_CONFIGURED
