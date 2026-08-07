"""Unit tests for contract reminder recipient resolution and lead-day matching."""

from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models import (
    Category,
    Contract,
    CostAllocation,
    CostItem,
    EntryType,
    Party,
    PaymentInterval,
    Person,
    User,
    UserRole,
)
from app.services.reminders import (
    REMINDER_END,
    REMINDER_NOTICE,
    collect_candidates,
    email_for_person,
    get_or_create_smtp_settings,
    notice_deadline,
    parse_lead_days,
    resolve_recipients,
)


def test_parse_lead_days():
    assert parse_lead_days("30,14,7,1") == [30, 14, 7, 1]
    assert parse_lead_days(" 7 , 7 , 0 ") == [7, 0]


def test_notice_deadline():
    contract = Contract(
        cost_item_id=1,
        provider="X",
        end_date=date(2026, 12, 31),
        notice_period_days=90,
    )
    assert notice_deadline(contract) == date(2026, 10, 2)


def test_email_prefers_linked_user(db_session: Session):
    person = Person(name="Alex", email="person@example.com")
    db_session.add(person)
    db_session.flush()
    db_session.add(
        User(
            username="alex",
            password_hash=hash_password("secret12"),
            email="user@example.com",
            role=UserRole.user,
            is_active=True,
            person_id=person.id,
        )
    )
    db_session.commit()
    assert email_for_person(db_session, person) == "user@example.com"


def test_resolve_party_recipients(db_session: Session):
    party = Party(name="Haushalt Nord")
    db_session.add(party)
    db_session.flush()
    p1 = Person(name="A", email="a@example.com", party_id=party.id)
    p2 = Person(name="B", email="b@example.com", party_id=party.id)
    db_session.add_all([p1, p2])
    cat = db_session.query(Category).first()
    item = CostItem(
        name="Strom",
        category_id=cat.id,
        amount=Decimal("10.00"),
        currency="EUR",
        entry_type=EntryType.expense,
        payment_interval=PaymentInterval.monthly,
        is_active=True,
    )
    db_session.add(item)
    db_session.flush()
    db_session.add(
        CostAllocation(
            cost_item_id=item.id,
            party_id=party.id,
            is_household=False,
            percentage=Decimal("100.00"),
        )
    )
    db_session.commit()
    emails, has_assignment = resolve_recipients(db_session, item)
    assert has_assignment is True
    assert emails == ["a@example.com", "b@example.com"]


def test_collect_candidates_respects_toggles(db_session: Session):
    cat = db_session.query(Category).first()
    item = CostItem(
        name="Internet",
        category_id=cat.id,
        amount=Decimal("40.00"),
        currency="EUR",
        entry_type=EntryType.expense,
        payment_interval=PaymentInterval.monthly,
        is_active=True,
        due_day=15,
    )
    db_session.add(item)
    db_session.flush()
    end = date(2026, 6, 30)
    db_session.add(
        Contract(
            cost_item_id=item.id,
            provider="Netze",
            start_date=date(2026, 1, 15),
            end_date=end,
            notice_period_days=30,
            auto_renewal=True,
        )
    )
    settings = get_or_create_smtp_settings(db_session)
    settings.notify_notice_deadline = True
    settings.notify_contract_end = False
    settings.notify_contract_start = False
    settings.notify_due_dates = False
    settings.notify_one_time = False
    settings.notify_price_change = False
    db_session.commit()

    today = date(2026, 5, 1)  # 30 days before notice deadline May 31
    candidates = collect_candidates(db_session, today=today)
    types = {c.reminder_type for c in candidates}
    assert REMINDER_NOTICE in types
    assert REMINDER_END not in types


def test_collect_candidates_notice_and_end(db_session: Session):
    cat = db_session.query(Category).first()
    item = CostItem(
        name="Internet",
        category_id=cat.id,
        amount=Decimal("40.00"),
        currency="EUR",
        entry_type=EntryType.expense,
        payment_interval=PaymentInterval.monthly,
        is_active=True,
    )
    db_session.add(item)
    db_session.flush()
    end = date(2026, 6, 30)
    db_session.add(
        Contract(
            cost_item_id=item.id,
            provider="Netze",
            end_date=end,
            notice_period_days=30,
            auto_renewal=True,
        )
    )
    settings = get_or_create_smtp_settings(db_session)
    settings.notify_notice_deadline = True
    settings.notify_contract_end = True
    db_session.commit()

    # 30 days before notice deadline (end-30 = 2026-05-31)
    today = date(2026, 5, 1)  # 30 days before May 31
    candidates = collect_candidates(db_session, today=today)
    types = {c.reminder_type for c in candidates}
    assert REMINDER_NOTICE in types

    # 14 days before end
    today_end = end - timedelta(days=14)
    candidates_end = collect_candidates(db_session, today=today_end)
    assert any(c.reminder_type == REMINDER_END for c in candidates_end)


def test_collect_candidates_renewal_notice(db_session: Session):
    """After initial term, reminders use renewal period end and renewal notice."""
    cat = db_session.query(Category).first()
    item = CostItem(
        name="Strom",
        category_id=cat.id,
        amount=Decimal("100.00"),
        currency="EUR",
        entry_type=EntryType.expense,
        payment_interval=PaymentInterval.monthly,
        is_active=True,
    )
    db_session.add(item)
    db_session.flush()
    db_session.add(
        Contract(
            cost_item_id=item.id,
            provider="Stadtwerke",
            start_date=date(2024, 1, 1),
            initial_term_months=24,
            end_date=date(2026, 1, 1),
            notice_period_days=90,
            auto_renewal=True,
            renewal_term_months=1,
            renewal_notice_period_days=30,
        )
    )
    settings = get_or_create_smtp_settings(db_session)
    settings.remind_days_before = "30,14,7,1,0"
    settings.notify_notice_deadline = True
    settings.notify_contract_end = False
    settings.notify_contract_start = False
    settings.notify_due_dates = False
    settings.notify_one_time = False
    settings.notify_price_change = False
    db_session.commit()

    # First renewal slice ends 2026-02-01 → notice deadline 2026-01-02 (30 days)
    today = date(2026, 1, 2)
    candidates = collect_candidates(db_session, today=today)
    notice = [c for c in candidates if c.reminder_type == REMINDER_NOTICE]
    assert len(notice) == 1
    assert notice[0].target_date == date(2026, 1, 2)

    # Period-end reminder for first renewal slice (14 days before 2026-02-01)
    settings.notify_notice_deadline = False
    settings.notify_contract_end = True
    db_session.commit()
    today_end = date(2026, 1, 18)
    candidates_end = collect_candidates(db_session, today=today_end)
    ends = [c for c in candidates_end if c.reminder_type == REMINDER_END]
    assert len(ends) == 1
    assert ends[0].target_date == date(2026, 2, 1)
