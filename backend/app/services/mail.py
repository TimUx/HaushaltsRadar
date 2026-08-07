"""SMTP mail sending helpers."""

from __future__ import annotations

import smtplib
import ssl
from email.message import EmailMessage

from app.models import SmtpSettings


def settings_ready(settings: SmtpSettings) -> bool:
    return bool(
        settings.enabled
        and settings.host
        and settings.from_email
        and settings.port
    )


def send_email(
    settings: SmtpSettings,
    *,
    to_addrs: list[str],
    subject: str,
    body: str,
    cc_addrs: list[str] | None = None,
) -> None:
    to_clean = sorted({a.strip() for a in to_addrs if a and a.strip()})
    cc_clean = sorted({a.strip() for a in (cc_addrs or []) if a and a.strip()})
    # Avoid duplicating addresses that are already in To
    cc_clean = [a for a in cc_clean if a not in to_clean]
    if not to_clean and not cc_clean:
        raise ValueError("Keine Empfänger-Adressen")
    if not to_clean:
        # Fallback: send with default as To
        to_clean = cc_clean
        cc_clean = []

    msg = EmailMessage()
    from_name = (settings.from_name or "").strip()
    from_email = settings.from_email.strip()
    msg["From"] = f"{from_name} <{from_email}>" if from_name else from_email
    msg["To"] = ", ".join(to_clean)
    if cc_clean:
        msg["Cc"] = ", ".join(cc_clean)
    msg["Subject"] = subject
    msg.set_content(body)

    all_rcpt = to_clean + cc_clean
    host = settings.host.strip()
    port = int(settings.port)
    timeout = 30

    if settings.use_ssl:
        context = ssl.create_default_context()
        with smtplib.SMTP_SSL(host, port, context=context, timeout=timeout) as smtp:
            if settings.username:
                smtp.login(settings.username, settings.password or "")
            smtp.send_message(msg, to_addrs=all_rcpt)
        return

    with smtplib.SMTP(host, port, timeout=timeout) as smtp:
        smtp.ehlo()
        if settings.use_tls:
            context = ssl.create_default_context()
            smtp.starttls(context=context)
            smtp.ehlo()
        if settings.username:
            smtp.login(settings.username, settings.password or "")
        smtp.send_message(msg, to_addrs=all_rcpt)
