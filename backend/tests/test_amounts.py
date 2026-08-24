from datetime import date
from decimal import Decimal

from app.models import CostItem, EntryType, PaymentInterval
from app.services.amounts import (
    amortized_one_time_in_month,
    monthly_amount,
    one_time_allocation_year,
    one_time_amount_in_month,
    one_time_overlaps_year,
    one_time_starts_in_year,
    one_time_window,
    yearly_amount,
)


def _item(
    amount: str,
    interval: PaymentInterval,
    custom: int | None = None,
    *,
    entry_type: EntryType = EntryType.expense,
    start_date: date | None = None,
) -> CostItem:
    return CostItem(
        name="Test",
        category_id=1,
        amount=Decimal(amount),
        currency="EUR",
        entry_type=entry_type,
        payment_interval=interval,
        custom_interval_months=custom,
        start_date=start_date,
        is_active=True,
    )


def test_monthly_amount_monthly():
    assert monthly_amount(_item("120.00", PaymentInterval.monthly)) == Decimal("120.00")


def test_monthly_amount_annual():
    assert monthly_amount(_item("1200.00", PaymentInterval.annual)) == Decimal("100.00")


def test_monthly_amount_quarterly():
    assert monthly_amount(_item("300.00", PaymentInterval.quarterly)) == Decimal("100.00")


def test_yearly_amount_monthly():
    assert yearly_amount(_item("100.00", PaymentInterval.monthly)) == Decimal("1200.00")


def test_monthly_amount_custom():
    assert monthly_amount(_item("240.00", PaymentInterval.custom, custom=2)) == Decimal("120.00")


def test_one_time_amortized_in_following_calendar_year():
    """Einmalkosten Jahr Y → gleichmäßig auf Jan–Dez von Y+1."""
    item = _item("218.40", PaymentInterval.one_time, start_date=date(2026, 7, 1))
    assert monthly_amount(item) == Decimal("18.20")
    assert yearly_amount(item) == Decimal("218.40")
    assert one_time_allocation_year(item) == 2027
    assert one_time_window(item) == (date(2027, 1, 1), date(2027, 12, 1))

    # Ereignisjahr 2026: kein Monatsanteil
    assert amortized_one_time_in_month(item, date(2026, 7, 1)) == Decimal("0.00")
    assert amortized_one_time_in_month(item, date(2026, 12, 1)) == Decimal("0.00")
    # Folgejahr 2027: volles Kalenderjahr
    assert amortized_one_time_in_month(item, date(2027, 1, 1)) == Decimal("18.20")
    assert amortized_one_time_in_month(item, date(2027, 6, 1)) == Decimal("18.20")
    assert amortized_one_time_in_month(item, date(2027, 12, 1)) == Decimal("18.20")
    assert amortized_one_time_in_month(item, date(2028, 1, 1)) == Decimal("0.00")

    assert one_time_overlaps_year(item, 2026) is False
    assert one_time_overlaps_year(item, 2027) is True
    assert one_time_starts_in_year(item, 2026) is True
    assert one_time_starts_in_year(item, 2027) is False

    assert one_time_amount_in_month(item, date(2026, 7, 1)) == Decimal("218.40")
    assert one_time_amount_in_month(item, date(2027, 1, 1)) == Decimal("0.00")
