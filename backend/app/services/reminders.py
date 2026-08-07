"""Notification discovery and delivery for contracts, prices, dues, one-time items."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy.orm import Session, joinedload

from app.models import (
    Contract,
    CostAllocation,
    CostHistoryEvent,
    CostItem,
    PaymentInterval,
    Person,
    PriceHistory,
    ReminderLog,
    SmtpSettings,
    User,
)
from app.services.contract_terms import (
    active_notice_period_days,
    current_period_end,
    in_renewal_phase,
    notice_deadline,
)
from app.services.due_dates import format_due_label, next_due_sort_key
from app.services.mail import send_email, settings_ready

REMINDER_NOTICE = "notice_deadline"
REMINDER_END = "contract_end"
REMINDER_START = "contract_start"
REMINDER_PRICE = "price_change"
REMINDER_ONE_TIME = "one_time"
REMINDER_DUE = "due_date"


@dataclass
class ReminderCandidate:
    reminder_type: str
    subject_key: str
    cost_item: CostItem
    target_date: date
    lead_days: int
    days_until: int
    contract: Contract | None = None
    price_history: PriceHistory | None = None
    previous_amount: Decimal | None = None
    details: dict[str, str] = field(default_factory=dict)


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
    """Returns (to_emails, has_person_or_party_assignment)."""
    allocations = (
        db.query(CostAllocation)
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


def _match_lead(target: date, today: date, lead_days: list[int]) -> int | None:
    days_until = (target - today).days
    if days_until in lead_days:
        return days_until
    return None


def next_due_date(item: CostItem, today: date) -> date | None:
    if item.due_day is None and item.due_month is None:
        return None
    year, month, day = next_due_sort_key(item, today)
    try:
        return date(year, month, day)
    except ValueError:
        return date(year, month, min(day, 28))


def collect_candidates(db: Session, today: date | None = None) -> list[ReminderCandidate]:
    today = today or date.today()
    settings = get_or_create_smtp_settings(db)
    lead_days = parse_lead_days(settings.remind_days_before)
    candidates: list[ReminderCandidate] = []

    if (
        settings.notify_notice_deadline
        or settings.notify_contract_end
        or settings.notify_contract_start
    ):
        contracts = (
            db.query(Contract).options(joinedload(Contract.cost_item)).all()
        )
        for contract in contracts:
            item = contract.cost_item
            if item is None or not item.is_active:
                continue

            if settings.notify_notice_deadline:
                deadline = notice_deadline(contract, today)
                if deadline:
                    matched = _match_lead(deadline, today, lead_days)
                    if matched is not None:
                        candidates.append(
                            ReminderCandidate(
                                reminder_type=REMINDER_NOTICE,
                                subject_key=f"contract:{contract.id}",
                                cost_item=item,
                                contract=contract,
                                target_date=deadline,
                                lead_days=matched,
                                days_until=matched,
                            )
                        )

            if settings.notify_contract_end:
                period_end = current_period_end(contract, today)
                if period_end:
                    matched = _match_lead(period_end, today, lead_days)
                    if matched is not None:
                        candidates.append(
                            ReminderCandidate(
                                reminder_type=REMINDER_END,
                                subject_key=f"contract:{contract.id}",
                                cost_item=item,
                                contract=contract,
                                target_date=period_end,
                                lead_days=matched,
                                days_until=matched,
                            )
                        )

            if settings.notify_contract_start and contract.start_date:
                matched = _match_lead(contract.start_date, today, lead_days)
                if matched is not None:
                    candidates.append(
                        ReminderCandidate(
                            reminder_type=REMINDER_START,
                            subject_key=f"contract:{contract.id}",
                            cost_item=item,
                            contract=contract,
                            target_date=contract.start_date,
                            lead_days=matched,
                            days_until=matched,
                        )
                    )

    if settings.notify_price_change:
        histories = (
            db.query(PriceHistory)
            .options(joinedload(PriceHistory.cost_item))
            .filter(PriceHistory.event_type == CostHistoryEvent.changed)
            .order_by(PriceHistory.cost_item_id, PriceHistory.valid_from, PriceHistory.id)
            .all()
        )
        all_hist = (
            db.query(PriceHistory)
            .order_by(PriceHistory.cost_item_id, PriceHistory.valid_from, PriceHistory.id)
            .all()
        )
        chronological_prev: dict[int, Decimal | None] = {}
        prev_amount_at: dict[int, Decimal] = {}
        for h in all_hist:
            chronological_prev[h.id] = prev_amount_at.get(h.cost_item_id)
            prev_amount_at[h.cost_item_id] = Decimal(h.amount)

        for hist in histories:
            item = hist.cost_item
            if item is None or not item.is_active:
                continue
            matched = _match_lead(hist.valid_from, today, lead_days)
            if matched is None:
                continue
            prev_amt = chronological_prev.get(hist.id)
            candidates.append(
                ReminderCandidate(
                    reminder_type=REMINDER_PRICE,
                    subject_key=f"price:{hist.id}",
                    cost_item=item,
                    price_history=hist,
                    previous_amount=prev_amt,
                    target_date=hist.valid_from,
                    lead_days=matched,
                    days_until=matched,
                )
            )

    if settings.notify_one_time:
        items = (
            db.query(CostItem)
            .filter(
                CostItem.is_active.is_(True),
                CostItem.payment_interval == PaymentInterval.one_time,
                CostItem.start_date.isnot(None),
            )
            .all()
        )
        for item in items:
            assert item.start_date is not None
            matched = _match_lead(item.start_date, today, lead_days)
            if matched is None:
                continue
            candidates.append(
                ReminderCandidate(
                    reminder_type=REMINDER_ONE_TIME,
                    subject_key=f"cost_item:{item.id}",
                    cost_item=item,
                    target_date=item.start_date,
                    lead_days=matched,
                    days_until=matched,
                    details={
                        "entry_type": item.entry_type.value,
                        "amount": str(item.amount),
                    },
                )
            )

    if settings.notify_due_dates:
        items = (
            db.query(CostItem)
            .filter(
                CostItem.is_active.is_(True),
                CostItem.payment_interval != PaymentInterval.one_time,
            )
            .all()
        )
        for item in items:
            due = next_due_date(item, today)
            if due is None:
                continue
            matched = _match_lead(due, today, lead_days)
            if matched is None:
                continue
            candidates.append(
                ReminderCandidate(
                    reminder_type=REMINDER_DUE,
                    subject_key=f"cost_item:{item.id}:{due.isoformat()}",
                    cost_item=item,
                    target_date=due,
                    lead_days=matched,
                    days_until=matched,
                    details={
                        "due_label": format_due_label(item.due_day, item.due_month),
                        "amount": str(item.amount),
                    },
                )
            )

    return candidates


def _already_sent(
    db: Session,
    *,
    subject_key: str,
    reminder_type: str,
    target_date: date,
    lead_days: int,
) -> bool:
    return (
        db.query(ReminderLog)
        .filter(
            ReminderLog.subject_key == subject_key,
            ReminderLog.reminder_type == reminder_type,
            ReminderLog.target_date == target_date,
            ReminderLog.lead_days == lead_days,
        )
        .first()
        is not None
    )


def _format_body(candidate: ReminderCandidate) -> tuple[str, str]:
    item = candidate.cost_item
    contract = candidate.contract

    if candidate.reminder_type == REMINDER_NOTICE:
        kind = "Kündigungsfrist"
        subject = f"HaushaltsRadar: Kündigungsfrist in {candidate.days_until} Tag(en) – {item.name}"
    elif candidate.reminder_type == REMINDER_END:
        kind = "Vertragsende"
        subject = f"HaushaltsRadar: Vertragsende in {candidate.days_until} Tag(en) – {item.name}"
    elif candidate.reminder_type == REMINDER_START:
        kind = "Vertragsbeginn"
        subject = f"HaushaltsRadar: Vertragsbeginn in {candidate.days_until} Tag(en) – {item.name}"
    elif candidate.reminder_type == REMINDER_PRICE:
        kind = "Preisänderung"
        subject = f"HaushaltsRadar: Preisänderung in {candidate.days_until} Tag(en) – {item.name}"
    elif candidate.reminder_type == REMINDER_ONE_TIME:
        kind = "Einmalzahlung"
        et = "Einnahme" if candidate.details.get("entry_type") == "income" else "Ausgabe"
        subject = (
            f"HaushaltsRadar: Einmalige {et} in {candidate.days_until} Tag(en) – {item.name}"
        )
    else:
        kind = "Fälligkeit"
        subject = f"HaushaltsRadar: Fälligkeit in {candidate.days_until} Tag(en) – {item.name}"

    lines = [f"Erinnerung: {kind}", "", f"Posten: {item.name}"]

    if contract:
        today = date.today()
        period_end = current_period_end(contract, today)
        deadline = notice_deadline(contract, today)
        notice_days = active_notice_period_days(contract, today)
        renewing = in_renewal_phase(contract, today)

        lines.append(f"Anbieter: {contract.provider}")
        if contract.contract_number:
            lines.append(f"Vertragsnummer: {contract.contract_number}")
        if contract.start_date:
            lines.append(f"Vertragsbeginn: {contract.start_date.isoformat()}")
        if contract.initial_term_months:
            lines.append(f"Anfangslaufzeit: {contract.initial_term_months} Monat(e)")
        if contract.end_date:
            label = "Ende der Anfangslaufzeit" if contract.auto_renewal else "Vertragsende"
            lines.append(f"{label}: {contract.end_date.isoformat()}")
        if period_end:
            if renewing:
                lines.append(f"Ende der aktuellen Verlängerungsperiode: {period_end.isoformat()}")
            elif period_end != contract.end_date:
                lines.append(f"Aktuelles Periodenende: {period_end.isoformat()}")
        if notice_days is not None:
            if renewing:
                lines.append(f"Kündigungsfrist (Verlängerung): {notice_days} Tage")
            else:
                lines.append(f"Kündigungsfrist: {notice_days} Tage")
            if deadline:
                lines.append(f"Letzter Kündigungstermin: {deadline.isoformat()}")
        lines.append(f"Automatische Verlängerung: {'ja' if contract.auto_renewal else 'nein'}")
        if contract.auto_renewal:
            if contract.renewal_term_months:
                lines.append(f"Verlängerungslaufzeit: {contract.renewal_term_months} Monat(e)")
            if contract.renewal_notice_period_days is not None:
                lines.append(
                    f"Kündigungsfrist nach Verlängerung: {contract.renewal_notice_period_days} Tage"
                )
            if renewing:
                lines.append("Status: Vertrag befindet sich in der Verlängerungsphase")
        if contract.notes:
            lines.extend(["", f"Notizen: {contract.notes}"])

    if candidate.reminder_type == REMINDER_PRICE and candidate.price_history:
        hist = candidate.price_history
        if candidate.previous_amount is not None:
            lines.append(f"Bisheriger Betrag: {candidate.previous_amount} {item.currency}")
        lines.append(f"Neuer Betrag: {hist.amount} {item.currency}")
        lines.append(f"Gültig ab: {hist.valid_from.isoformat()}")
        if hist.notes:
            lines.append(f"Hinweis: {hist.notes}")

    if candidate.reminder_type == REMINDER_ONE_TIME:
        lines.append(f"Betrag: {item.amount} {item.currency}")
        lines.append(f"Datum: {candidate.target_date.isoformat()}")

    if candidate.reminder_type == REMINDER_DUE:
        lines.append(f"Fälligkeit: {candidate.details.get('due_label', candidate.target_date.isoformat())}")
        lines.append(f"Nächster Termin: {candidate.target_date.isoformat()}")
        lines.append(f"Betrag: {item.amount} {item.currency}")

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
            "candidates": 0,
            "errors": [],
        }

    any_topic = any(
        [
            settings.notify_notice_deadline,
            settings.notify_contract_end,
            settings.notify_contract_start,
            settings.notify_price_change,
            settings.notify_one_time,
            settings.notify_due_dates,
        ]
    )
    if not any_topic:
        return {
            "status": "skipped",
            "reason": "Keine Benachrichtigungs-Themen aktiviert",
            "sent": 0,
            "skipped": 0,
            "candidates": 0,
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
            subject_key=candidate.subject_key,
            reminder_type=candidate.reminder_type,
            target_date=candidate.target_date,
            lead_days=candidate.lead_days,
        ):
            skipped += 1
            continue

        to_addrs, _has_assignment = resolve_recipients(db, candidate.cost_item)
        cc_addrs = [default_cc] if default_cc else []

        if not to_addrs:
            if not default_cc:
                errors.append(
                    f"{candidate.reminder_type} / {candidate.cost_item.name}: "
                    "keine Empfänger und keine Default-E-Mail"
                )
                continue
            to_addrs = [default_cc]
            cc_addrs = []

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
        except Exception as exc:  # noqa: BLE001
            errors.append(f"{candidate.cost_item.name} ({candidate.reminder_type}): {exc}")
            continue

        if not force:
            db.add(
                ReminderLog(
                    subject_key=candidate.subject_key,
                    contract_id=candidate.contract.id if candidate.contract else None,
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
