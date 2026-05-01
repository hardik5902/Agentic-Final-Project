import logging
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail
from config import settings

logger = logging.getLogger(__name__)


def _send(to_email: str, subject: str, html_content: str) -> None:
    if not settings.SENDGRID_API_KEY:
        logger.warning("SENDGRID_API_KEY not set — skipping email to %s", to_email)
        return
    message = Mail(
        from_email=settings.EMAIL_FROM,
        to_emails=to_email,
        subject=subject,
        html_content=html_content,
    )
    try:
        sg = SendGridAPIClient(settings.SENDGRID_API_KEY)
        sg.send(message)
    except Exception as exc:
        logger.error("SendGrid error: %s", exc)
        raise


def send_supplier_invitation(
    supplier_email: str,
    supplier_name: str,
    rfq_title: str,
    deadline: str,
    portal_token: str,
    buyer_company: str,
) -> None:
    portal_url = f"{settings.SUPPLIER_PORTAL_URL}/{portal_token}"
    subject = f"RFQ: {rfq_title} — Response requested by {deadline}"
    html = f"""
    <p>Dear {supplier_name},</p>
    <p><strong>{buyer_company}</strong> has invited you to respond to an RFQ:</p>
    <h2>{rfq_title}</h2>
    <p>Deadline: <strong>{deadline}</strong></p>
    <p><a href="{portal_url}" style="background:#1d4ed8;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;">
        View RFQ &amp; Respond
    </a></p>
    <p>No account required — click the link above to get started.</p>
    """
    _send(supplier_email, subject, html)


def send_deadline_reminder(
    supplier_email: str,
    supplier_name: str,
    rfq_title: str,
    deadline: str,
    portal_token: str,
    days_remaining: int,
) -> None:
    portal_url = f"{settings.SUPPLIER_PORTAL_URL}/{portal_token}"
    subject = f"Reminder: {days_remaining} day(s) left to respond — {rfq_title}"
    html = f"""
    <p>Dear {supplier_name},</p>
    <p>This is a reminder that your response to <strong>{rfq_title}</strong> is due in
    <strong>{days_remaining} day(s)</strong> ({deadline}).</p>
    <p><a href="{portal_url}">Submit your response</a></p>
    """
    _send(supplier_email, subject, html)


def send_response_received(
    buyer_email: str,
    buyer_name: str,
    supplier_name: str,
    rfq_title: str,
    response_count: int,
    invited_count: int,
) -> None:
    all_in = response_count == invited_count
    subject = (
        f"All responses received — {rfq_title}" if all_in
        else f"New response from {supplier_name} — {rfq_title}"
    )
    html = f"""
    <p>Hi {buyer_name},</p>
    <p>{'All suppliers have responded to' if all_in else f'{supplier_name} has submitted a response to'}
    <strong>{rfq_title}</strong>.</p>
    <p>Responses: {response_count} / {invited_count}</p>
    <p><a href="{settings.FRONTEND_URL}">View responses in QuoteFlow</a></p>
    """
    _send(buyer_email, subject, html)
