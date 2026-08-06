from datetime import date
from decimal import Decimal

from app.models import CostItem, EntryType, PaymentInterval
from app.services.amounts import monthly_amount, one_time_amount_in_month, yearly_amount


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


def test_one_time_has_zero_monthly():
    item = _item("218.40", PaymentInterval.one_time, start_date=date(2026, 3, 15))
    assert monthly_amount(item) == Decimal("0.00")
    assert yearly_amount(item) == Decimal("0.00")
    assert one_time_amount_in_month(item, date(2026, 3, 1)) == Decimal("218.40")
    assert one_time_amount_in_month(item, date(2026, 4, 1)) == Decimal("0.00")
