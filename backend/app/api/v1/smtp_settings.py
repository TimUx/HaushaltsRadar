from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import require_admin
from app.db.session import get_db
from app.models import User
from app.schemas import (
    ReminderRunResult,
    SmtpSettingsRead,
    SmtpSettingsUpdate,
    SmtpTestRequest,
)
from app.services.mail import send_email
from app.services.reminders import get_or_create_smtp_settings, process_reminders

router = APIRouter(prefix="/admin/smtp", tags=["SMTP"])


def _to_read(row) -> SmtpSettingsRead:
    return SmtpSettingsRead(
        enabled=row.enabled,
        host=row.host,
        port=row.port,
        use_tls=row.use_tls,
        use_ssl=row.use_ssl,
        username=row.username,
        password_set=bool(row.password),
        from_email=row.from_email,
        from_name=row.from_name,
        default_cc_email=row.default_cc_email,
        remind_days_before=row.remind_days_before or "30,14,7,1",
        notify_notice_deadline=bool(getattr(row, "notify_notice_deadline", True)),
        notify_contract_end=bool(getattr(row, "notify_contract_end", True)),
        notify_contract_start=bool(getattr(row, "notify_contract_start", False)),
        notify_price_change=bool(getattr(row, "notify_price_change", False)),
        notify_one_time=bool(getattr(row, "notify_one_time", False)),
        notify_due_dates=bool(getattr(row, "notify_due_dates", False)),
    )


@router.get("", response_model=SmtpSettingsRead)
def get_smtp_settings(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> SmtpSettingsRead:
    return _to_read(get_or_create_smtp_settings(db))


@router.put("", response_model=SmtpSettingsRead)
def update_smtp_settings(
    payload: SmtpSettingsUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> SmtpSettingsRead:
    row = get_or_create_smtp_settings(db)
    data = payload.model_dump(exclude_unset=True)
    clear_password = bool(data.pop("clear_password", False))
    password = data.pop("password", None)

    for key, value in data.items():
        if isinstance(value, str):
            value = value.strip() or None
        setattr(row, key, value)

    if clear_password:
        row.password = None
    elif password is not None and password != "":
        row.password = password

    if row.use_ssl and row.use_tls:
        # Prefer explicit SSL (e.g. port 465)
        row.use_tls = False

    db.add(row)
    db.commit()
    db.refresh(row)
    return _to_read(row)


@router.post("/test")
def test_smtp(
    payload: SmtpTestRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> dict:
    row = get_or_create_smtp_settings(db)
    # Allow testing with current form values already saved; require host/from
    if not row.host or not row.from_email:
        raise HTTPException(
            status_code=400,
            detail="Bitte Host und Absender-E-Mail speichern, bevor du testest",
        )
    to_email = (payload.to_email or row.default_cc_email or row.from_email or "").strip()
    if not to_email:
        raise HTTPException(status_code=400, detail="Keine Test-Empfängeradresse")

    # Temporarily treat as ready for send (enabled may still be off)
    try:
        send_email(
            row,
            to_addrs=[to_email],
            subject="HaushaltsRadar SMTP-Test",
            body=(
                "Dies ist eine Testnachricht von HaushaltsRadar.\n"
                "Wenn du diese E-Mail siehst, funktioniert der SMTP-Versand.\n"
            ),
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"SMTP-Test fehlgeschlagen: {exc}") from exc
    return {"status": "ok", "to": to_email}


@router.post("/run-reminders", response_model=ReminderRunResult)
def run_reminders_now(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> ReminderRunResult:
    result = process_reminders(db)
    return ReminderRunResult(**result)
