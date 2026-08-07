"""Contract reminder discovery and delivery."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone

from sqlalchemy.orm import Session, joinedload

from app.models import (
    Contract,
    CostAllocation,
    CostItem,
    Person,
    ReminderLog,
    SmtpSettings,
    User,
)
from app.services.mail import send_email, settings_ready

REMINDER_NOTICE = "notice_deadline"
REMINDER_END = "contract_end"


@dataclass
class ReminderCandidate:
    contract: Contract
    cost_item: CostItem
    reminder_type: str
    target_date: date
    lead_days: int
    days_until: int


def get_or_create_smtp_settings(db: Session) -> SmtpSettings:
    row = db.get(SmtpSettings, 1)
    if row:
        return row
    row = SmtpSettings(id=1)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def parse_lead_days(raw: str | None) -> list[int]:
    if not raw:
        return [30, 14, 7, 1]
    days: list[int] = []
    for part in raw.split(","):
        part = part.strip()
        if not part:
            continue
        try:
            value = int(part)
        except ValueError:
            continue
        if value >= 0 and value not in days:
            days.append(value)
    return sorted(days, reverse=True) or [30, 14, 7, 1]


def notice_deadline(contract: Contract) -> date | None:
    if not contract.end_date:
        return None
    days = contract.notice_period_days
    if days is None or days < 0:
        return None
    return contract.end_date - timedelta(days=days)


def email_for_person(db: Session, person: Person) -> str | None:
    user = (
        db.query(User)
        .filter(
            User.person_id == person.id,
            User.is_active.is_(True),
            User.email.isnot(None),
        )
        .order_by(User.id)
        .first()
    )
    if user and user.email and user.email.strip():
        return user.email.strip()
    if person.email and person.email.strip():
        return person.email.strip()
    return None


def resolve_recipients(db: Session, cost_item: CostItem) -> tuple[list[str], bool]:
    """
    Returns (to_emails, has_assignment).
    has_assignment=False means only household / no person/party → use default as To.
    """
    allocations = (
        db.query(CostAllocation)
        .options(joinedload(CostAllocation.person), joinedload(CostAllocation.party))
        .filter(CostAllocation.cost_item_id == cost_item.id)
        .all()
    )
    person_ids: set[int] = set()
    has_person_or_party = False
    for alloc in allocations:
        if alloc.person_id:
            has_person_or_party = True
            person_ids.add(alloc.person_id)
        if alloc.party_id:
            has_person_or_party = True
            party_persons = (
                db.query(Person)
                .filter(Person.party_id == alloc.party_id, Person.is_active.is_(True))
                .all()
            )
            for person in party_persons:
                person_ids.add(person.id)

    emails: set[str] = set()
    for pid in person_ids:
        person = db.get(Person, pid)
        if not person or not person.is_active:
            continue
        addr = email_for_person(db, person)
        if addr:
            emails.add(addr)
    return sorted(emails), has_person_or_party


def collect_candidates(db: Session, today: date | None = None) -> list[ReminderCandidate]:
    today = today or date.today()
    settings = get_or_create_smtp_settings(db)
    lead_days = parse_lead_days(settings.remind_days_before)

    contracts = (
        db.query(Contract)
        .options(joinedload(Contract.cost_item))
        .all()
    )
    candidates: list[ReminderCandidate] = []
    for contract in contracts:
        item = contract.cost_item
        if item is None or not item.is_active:
            continue

        deadline = notice_deadline(contract)
        if deadline:
            days_until = (deadline - today).days
            if days_until in lead_days:
                candidates.append(
                    ReminderCandidate(
                        contract=contract,
                        cost_item=item,
                        reminder_type=REMINDER_NOTICE,
                        target_date=deadline,
                        lead_days=days_until,
                        days_until=days_until,
                    )
                )

        if contract.end_date:
            days_until = (contract.end_date - today).days
            if days_until in lead_days:
                candidates.append(
                    ReminderCandidate(
                        contract=contract,
                        cost_item=item,
                        reminder_type=REMINDER_END,
                        target_date=contract.end_date,
                        lead_days=days_until,
                        days_until=days_until,
                    )
                )
    return candidates


def _already_sent(
    db: Session,
    *,
    contract_id: int,
    reminder_type: str,
    target_date: date,
    lead_days: int,
) -> bool:
    return (
        db.query(ReminderLog)
        .filter(
            ReminderLog.contract_id == contract_id,
            ReminderLog.reminder_type == reminder_type,
            ReminderLog.target_date == target_date,
            ReminderLog.lead_days == lead_days,
        )
        .first()
        is not None
    )


def _format_body(candidate: ReminderCandidate) -> tuple[str, str]:
    contract = candidate.contract
    item = candidate.cost_item
    if candidate.reminder_type == REMINDER_NOTICE:
        kind = "Kündigungsfrist"
        subject = (
            f"HaushaltsRadar: Kündigungsfrist in {candidate.days_until} Tag(en) – {item.name}"
        )
    else:
        kind = "Vertragsende"
        subject = f"HaushaltsRadar: Vertragsende in {candidate.days_until} Tag(en) – {item.name}"

    lines = [
        f"Erinnerung: {kind}",
        "",
        f"Posten: {item.name}",
        f"Anbieter: {contract.provider}",
    ]
    if contract.contract_number:
        lines.append(f"Vertragsnummer: {contract.contract_number}")
    if contract.start_date:
        lines.append(f"Vertragsbeginn: {contract.start_date.isoformat()}")
    if contract.end_date:
        lines.append(f"Vertragsende: {contract.end_date.isoformat()}")
    if contract.notice_period_days is not None:
        lines.append(f"Kündigungsfrist: {contract.notice_period_days} Tage")
        deadline = notice_deadline(contract)
        if deadline:
            lines.append(f"Letzter Kündigungstermin: {deadline.isoformat()}")
    lines.append(f"Automatische Verlängerung: {'ja' if contract.auto_renewal else 'nein'}")
    if contract.notes:
        lines.extend(["", f"Notizen: {contract.notes}"])
    lines.extend(
        [
            "",
            f"Stichtag: {candidate.target_date.isoformat()} "
            f"(noch {candidate.days_until} Tag(e))",
            "",
            "— HaushaltsRadar",
        ]
    )
    return subject, "\n".join(lines)


def process_reminders(
    db: Session,
    *,
    today: date | None = None,
    force: bool = False,
) -> dict:
    settings = get_or_create_smtp_settings(db)
    if not settings_ready(settings):
        return {
            "status": "skipped",
            "reason": "SMTP ist nicht aktiv oder unvollständig konfiguriert",
            "sent": 0,
            "skipped": 0,
            "errors": [],
        }

    candidates = collect_candidates(db, today=today)
    sent = 0
    skipped = 0
    errors: list[str] = []
    default_cc = (settings.default_cc_email or "").strip() or None

    for candidate in candidates:
        if not force and _already_sent(
            db,
            contract_id=candidate.contract.id,
            reminder_type=candidate.reminder_type,
            target_date=candidate.target_date,
            lead_days=candidate.lead_days,
        ):
            skipped += 1
            continue

        to_addrs, has_assignment = resolve_recipients(db, candidate.cost_item)
        cc_addrs = [default_cc] if default_cc else []

        if not to_addrs:
            # Unassigned or no emails → send to default
            if not default_cc:
                errors.append(
                    f"Vertrag {candidate.contract.id} ({candidate.cost_item.name}): "
                    "keine Empfänger und keine Default-E-Mail"
                )
                continue
            to_addrs = [default_cc]
            cc_addrs = []
        elif not has_assignment and default_cc and default_cc not in to_addrs:
            # Household-only: ensure default is informed as To if somehow empty
            pass

        # Always CC default when recipients exist and default is set
        if default_cc and default_cc not in to_addrs and default_cc not in cc_addrs:
            cc_addrs.append(default_cc)

        subject, body = _format_body(candidate)
        try:
            send_email(
                settings,
                to_addrs=to_addrs,
                cc_addrs=cc_addrs,
                subject=subject,
                body=body,
            )
        except Exception as exc:  # noqa: BLE001 — surface to admin summary
            errors.append(
                f"Vertrag {candidate.contract.id} ({candidate.cost_item.name}): {exc}"
            )
            continue

        if not force:
            db.add(
                ReminderLog(
                    contract_id=candidate.contract.id,
                    reminder_type=candidate.reminder_type,
                    target_date=candidate.target_date,
                    lead_days=candidate.lead_days,
                    recipients=", ".join(sorted(set(to_addrs + cc_addrs))),
                    sent_at=datetime.now(timezone.utc),
                )
            )
            db.commit()
        sent += 1

    return {
        "status": "ok",
        "sent": sent,
        "skipped": skipped,
        "candidates": len(candidates),
        "errors": errors,
    }


def run_reminders_job() -> None:
    from app.db.session import SessionLocal

    db = SessionLocal()
    try:
        process_reminders(db)
    finally:
        db.close()
