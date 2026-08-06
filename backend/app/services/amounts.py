from datetime import date
from decimal import Decimal

from app.models import CostItem, EntryType, PaymentInterval

INTERVAL_TO_MONTHS: dict[PaymentInterval, Decimal] = {
    PaymentInterval.monthly: Decimal("1"),
    PaymentInterval.bimonthly: Decimal("2"),
    PaymentInterval.quarterly: Decimal("3"),
    PaymentInterval.semiannual: Decimal("6"),
    PaymentInterval.annual: Decimal("12"),
}


def is_one_time(item: CostItem) -> bool:
    return item.payment_interval == PaymentInterval.one_time


def is_income(item: CostItem) -> bool:
    return item.entry_type == EntryType.income


def amount_sign(item: CostItem) -> Decimal:
    """Expense contributes +, income contributes − to net totals."""
    return Decimal("-1") if is_income(item) else Decimal("1")


def interval_months(item: CostItem) -> Decimal:
    if item.payment_interval == PaymentInterval.one_time:
        return Decimal("1")
    if item.payment_interval == PaymentInterval.custom:
        months = item.custom_interval_months or 1
        return Decimal(months)
    return INTERVAL_TO_MONTHS[item.payment_interval]


def monthly_from_amount(
    amount: Decimal,
    payment_interval: PaymentInterval,
    custom_interval_months: int | None = None,
) -> Decimal:
    """Normalize a raw amount to monthly equivalent for the given interval."""
    if payment_interval == PaymentInterval.one_time:
        return Decimal("0.00")
    if payment_interval == PaymentInterval.custom:
        months = Decimal(custom_interval_months or 1)
    else:
        months = INTERVAL_TO_MONTHS[payment_interval]
    return (Decimal(amount) / months).quantize(Decimal("0.01"))


def monthly_amount(item: CostItem) -> Decimal:
    """Recurring monthly equivalent; one-time items contribute 0 to running fixed costs."""
    if is_one_time(item):
        return Decimal("0.00")
    return monthly_from_amount(
        Decimal(item.amount),
        item.payment_interval,
        item.custom_interval_months,
    )

def yearly_amount(item: CostItem) -> Decimal:
    if is_one_time(item):
        return Decimal("0.00")
    return (monthly_amount(item) * Decimal("12")).quantize(Decimal("0.01"))


def _month_start(value: date) -> date:
    return date(value.year, value.month, 1)


def one_time_amount_in_month(item: CostItem, month: date) -> Decimal:
    """Full one-time amount if `month` is the item's effective month, else 0."""
    if not is_one_time(item):
        return Decimal("0.00")
    when = item.start_date
    if when is None:
        return Decimal("0.00")
    if _month_start(when) != _month_start(month):
        return Decimal("0.00")
    return Decimal(item.amount).quantize(Decimal("0.01"))
