from decimal import Decimal

from app.models import CostItem, PaymentInterval

INTERVAL_TO_MONTHS: dict[PaymentInterval, Decimal] = {
    PaymentInterval.monthly: Decimal("1"),
    PaymentInterval.bimonthly: Decimal("2"),
    PaymentInterval.quarterly: Decimal("3"),
    PaymentInterval.semiannual: Decimal("6"),
    PaymentInterval.annual: Decimal("12"),
}


def interval_months(item: CostItem) -> Decimal:
    if item.payment_interval == PaymentInterval.custom:
        months = item.custom_interval_months or 1
        return Decimal(months)
    return INTERVAL_TO_MONTHS[item.payment_interval]


def monthly_amount(item: CostItem) -> Decimal:
    months = interval_months(item)
    return (Decimal(item.amount) / months).quantize(Decimal("0.01"))


def yearly_amount(item: CostItem) -> Decimal:
    return (monthly_amount(item) * Decimal("12")).quantize(Decimal("0.01"))
