from decimal import Decimal

from app.models import CostItem, PaymentInterval
from app.services.amounts import monthly_amount, yearly_amount


def _item(amount: str, interval: PaymentInterval, custom: int | None = None) -> CostItem:
    return CostItem(
        name="Test",
        category_id=1,
        amount=Decimal(amount),
        currency="EUR",
        payment_interval=interval,
        custom_interval_months=custom,
    )


def test_monthly_amount_monthly():
    assert monthly_amount(_item("120.00", PaymentInterval.monthly)) == Decimal("120.00")


def test_monthly_amount_annual():
    assert monthly_amount(_item("1200.00", PaymentInterval.annual)) == Decimal("100.00")


def test_monthly_amount_quarterly():
    assert monthly_amount(_item("300.00", PaymentInterval.quarterly)) == Decimal("100.00")


def test_yearly_amount_monthly():
    assert yearly_amount(_item("100.00", PaymentInterval.monthly)) == Decimal("1200.00")


def test_custom_interval():
    assert monthly_amount(_item("240.00", PaymentInterval.custom, custom=2)) == Decimal("120.00")
