"""Tests for Historie timeline projection of recurring costs."""

from datetime import date, datetime
from decimal import Decimal
from unittest.mock import patch

from app.models import (
    Category,
    CostAllocation,
    CostHistoryEvent,
    CostItem,
    EntryType,
    PaymentInterval,
    PriceHistory,
)
from app.services.cost_history import _active_monthly_on, cost_history_timeline


def _history(
    *,
    valid_from: date,
    amount: str,
    monthly: str,
    event_type: CostHistoryEvent = CostHistoryEvent.created,
    id_: int = 1,
) -> PriceHistory:
    return PriceHistory(
        id=id_,
        cost_item_id=1,
        amount=Decimal(amount),
        monthly_amount=Decimal(monthly),
        valid_from=valid_from,
        event_type=event_type,
    )


def _recurring(
    *,
    amount: str = "120.00",
    interval: PaymentInterval = PaymentInterval.monthly,
    start_date: date | None = None,
    end_date: date | None = None,
    is_active: bool = True,
    entry_type: EntryType = EntryType.expense,
    created_at: datetime | None = None,
) -> CostItem:
    item = CostItem(
        name="Abo",
        category_id=1,
        amount=Decimal(amount),
        currency="EUR",
        entry_type=entry_type,
        payment_interval=interval,
        start_date=start_date,
        end_date=end_date,
        is_active=is_active,
    )
    if created_at is not None:
        item.created_at = created_at
    return item


def test_recurring_carries_back_before_first_history_without_start_date():
    """Late bookkeeping must not blank earlier months of the year."""
    item = _recurring(created_at=datetime(2026, 8, 6))
    history = [_history(valid_from=date(2026, 8, 6), amount="53.27", monthly="53.27")]

    assert _active_monthly_on(item, date(2026, 1, 1), history) == Decimal("53.27")
    assert _active_monthly_on(item, date(2026, 5, 1), history) == Decimal("53.27")
    assert _active_monthly_on(item, date(2026, 8, 1), history) == Decimal("53.27")


def test_recurring_respects_mid_year_start_date():
    item = _recurring(start_date=date(2026, 3, 15))
    history = [_history(valid_from=date(2026, 8, 6), amount="100.00", monthly="100.00")]

    assert _active_monthly_on(item, date(2026, 1, 1), history) == Decimal("0.00")
    assert _active_monthly_on(item, date(2026, 2, 1), history) == Decimal("0.00")
    assert _active_monthly_on(item, date(2026, 3, 1), history) == Decimal("100.00")
    assert _active_monthly_on(item, date(2026, 7, 1), history) == Decimal("100.00")


def test_recurring_price_change_applies_from_valid_from():
    item = _recurring(start_date=date(2026, 1, 1))
    history = [
        _history(
            valid_from=date(2026, 1, 1),
            amount="100.00",
            monthly="100.00",
            event_type=CostHistoryEvent.created,
            id_=1,
        ),
        _history(
            valid_from=date(2026, 6, 1),
            amount="120.00",
            monthly="120.00",
            event_type=CostHistoryEvent.changed,
            id_=2,
        ),
    ]

    assert _active_monthly_on(item, date(2026, 5, 1), history) == Decimal("100.00")
    assert _active_monthly_on(item, date(2026, 6, 1), history) == Decimal("120.00")


def test_recurring_income_is_negative():
    item = _recurring(amount="50.00", entry_type=EntryType.income)
    history = [_history(valid_from=date(2026, 8, 1), amount="50.00", monthly="50.00")]

    assert _active_monthly_on(item, date(2026, 1, 1), history) == Decimal("-50.00")


def test_one_time_only_in_start_month():
    item = CostItem(
        name="Nachzahlung",
        category_id=1,
        amount=Decimal("100.00"),
        currency="EUR",
        entry_type=EntryType.expense,
        payment_interval=PaymentInterval.one_time,
        start_date=date(2026, 7, 23),
        is_active=True,
    )
    history = [
        _history(
            valid_from=date(2026, 7, 23),
            amount="100.00",
            monthly="100.00",
            event_type=CostHistoryEvent.created,
        )
    ]

    assert _active_monthly_on(item, date(2026, 6, 1), history) == Decimal("0.00")
    assert _active_monthly_on(item, date(2026, 7, 1), history) == Decimal("100.00")
    assert _active_monthly_on(item, date(2026, 8, 1), history) == Decimal("0.00")


def test_ended_stops_contribution():
    item = _recurring(start_date=date(2026, 1, 1), is_active=False)
    history = [
        _history(
            valid_from=date(2026, 1, 1),
            amount="40.00",
            monthly="40.00",
            event_type=CostHistoryEvent.created,
            id_=1,
        ),
        _history(
            valid_from=date(2026, 4, 1),
            amount="0.00",
            monthly="0.00",
            event_type=CostHistoryEvent.ended,
            id_=2,
        ),
    ]

    assert _active_monthly_on(item, date(2026, 3, 1), history) == Decimal("40.00")
    assert _active_monthly_on(item, date(2026, 4, 1), history) == Decimal("0.00")


def test_cost_history_timeline_fills_jan_through_may(db_session):
    category = db_session.query(Category).first()
    assert category is not None

    item = CostItem(
        name="Internet",
        category_id=category.id,
        amount=Decimal("53.27"),
        currency="EUR",
        entry_type=EntryType.expense,
        payment_interval=PaymentInterval.monthly,
        start_date=None,
        is_active=True,
    )
    db_session.add(item)
    db_session.flush()
    db_session.add(
        CostAllocation(
            cost_item_id=item.id,
            is_household=True,
            percentage=Decimal("100.00"),
        )
    )
    db_session.add(
        PriceHistory(
            cost_item_id=item.id,
            amount=Decimal("53.27"),
            monthly_amount=Decimal("53.27"),
            valid_from=date(2026, 8, 6),
            event_type=CostHistoryEvent.created,
            notes="Late entry",
        )
    )
    db_session.commit()

    class _FrozenDate(date):
        @classmethod
        def today(cls) -> date:
            return date(2026, 8, 7)

    with patch("app.services.cost_history.date", _FrozenDate):
        data = cost_history_timeline(db_session, months_back=12, forecast_months=0)

    by_month = {p["month"]: Decimal(str(p["monthly_total"])) for p in data["series"]}
    assert by_month["2026-01"] == Decimal("53.27")
    assert by_month["2026-05"] == Decimal("53.27")
    assert by_month["2026-08"] == Decimal("53.27")
    assert data["summary"]["start_monthly"] == Decimal("53.27")
