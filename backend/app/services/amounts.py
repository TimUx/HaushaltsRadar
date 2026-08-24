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

ONE_TIME_AMORTIZATION_MONTHS = 12


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
        # Abrechnung: Einmalbetrag gleichmäßig auf Jan–Dez des Folgejahres.
        return (Decimal(amount) / Decimal(ONE_TIME_AMORTIZATION_MONTHS)).quantize(
            Decimal("0.01")
        )
    if payment_interval == PaymentInterval.custom:
        months = Decimal(custom_interval_months or 1)
    else:
        months = INTERVAL_TO_MONTHS[payment_interval]
    return (Decimal(amount) / months).quantize(Decimal("0.01"))


def monthly_amount(item: CostItem) -> Decimal:
    """Monthly equivalent; one-time items are amortized over 12 months."""
    return monthly_from_amount(
        Decimal(item.amount),
        item.payment_interval,
        item.custom_interval_months,
    )


def yearly_amount(item: CostItem) -> Decimal:
    if is_one_time(item):
        return Decimal(item.amount).quantize(Decimal("0.01"))
    return (monthly_amount(item) * Decimal("12")).quantize(Decimal("0.01"))


def _month_start(value: date) -> date:
    return date(value.year, value.month, 1)


def add_calendar_months(month_start: date, months: int) -> date:
    """Add whole months to a date, keeping day 1 when given a month start."""
    year = month_start.year + (month_start.month - 1 + months) // 12
    month = (month_start.month - 1 + months) % 12 + 1
    return date(year, month, 1)


def one_time_allocation_year(item: CostItem) -> int | None:
    """Calendar year in which a one-time item is amortized (always start_year + 1)."""
    if not is_one_time(item) or item.start_date is None:
        return None
    return item.start_date.year + 1


def one_time_window(item: CostItem) -> tuple[date, date] | None:
    """Inclusive Jan–Dec of the allocation year (Folgejahr des Ereignisdatums)."""
    alloc_year = one_time_allocation_year(item)
    if alloc_year is None:
        return None
    return date(alloc_year, 1, 1), date(alloc_year, 12, 1)


def one_time_active_in_month(item: CostItem, month: date) -> bool:
    """True if `month` lies in Jan–Dec of the allocation year."""
    alloc_year = one_time_allocation_year(item)
    if alloc_year is None:
        return False
    return _month_start(month).year == alloc_year


def one_time_overlaps_year(item: CostItem, year: int) -> bool:
    """True if `year` is the allocation year (start_date.year + 1)."""
    return one_time_allocation_year(item) == year


def one_time_starts_in_year(item: CostItem, year: int) -> bool:
    """True if the one-time event date falls into the given calendar year."""
    return is_one_time(item) and item.start_date is not None and item.start_date.year == year


def one_time_in_year(item: CostItem, year: int) -> bool:
    """Deprecated alias: allocation year match (prefer one_time_overlaps_year)."""
    return one_time_overlaps_year(item, year)


def one_time_amount_in_month(item: CostItem, month: date) -> Decimal:
    """Full one-time amount if `month` is the item's start month, else 0."""
    if not is_one_time(item):
        return Decimal("0.00")
    when = item.start_date
    if when is None:
        return Decimal("0.00")
    if _month_start(when) != _month_start(month):
        return Decimal("0.00")
    return Decimal(item.amount).quantize(Decimal("0.01"))


def one_time_raw_amount(item: CostItem, history: list | None = None) -> Decimal:
    """Full one-time principal (latest history amount at/before start, else item.amount)."""
    if not is_one_time(item):
        return Decimal("0.00")
    if history and item.start_date is not None:
        start = _month_start(item.start_date)
        applicable = None
        for entry in history:
            if _month_start(entry.valid_from) <= start:
                applicable = entry
            else:
                break
        if applicable is not None:
            return Decimal(applicable.amount).quantize(Decimal("0.01"))
    return Decimal(item.amount).quantize(Decimal("0.01"))


def amortized_one_time_in_month(
    item: CostItem,
    month: date,
    *,
    full_amount: Decimal | None = None,
) -> Decimal:
    """Monthly share (amount/12) if `month` is in the amortization window."""
    if not one_time_active_in_month(item, month):
        return Decimal("0.00")
    amount = Decimal(item.amount) if full_amount is None else Decimal(full_amount)
    if amount == 0:
        return Decimal("0.00")
    return (amount / Decimal(ONE_TIME_AMORTIZATION_MONTHS)).quantize(Decimal("0.01"))


def amortized_one_time_in_year(
    item: CostItem,
    year: int,
    *,
    full_amount: Decimal | None = None,
    reference_month: date | None = None,
) -> Decimal:
    """
    Monthly share for dashboard snapshots.

    If `reference_month` is given, only count when that month is in the window.
    Otherwise (legacy), count when the window overlaps `year`.
    """
    if reference_month is not None:
        return amortized_one_time_in_month(
            item, reference_month, full_amount=full_amount
        )
    if not one_time_overlaps_year(item, year):
        return Decimal("0.00")
    amount = Decimal(item.amount) if full_amount is None else Decimal(full_amount)
    if amount == 0:
        return Decimal("0.00")
    return (amount / Decimal(ONE_TIME_AMORTIZATION_MONTHS)).quantize(Decimal("0.01"))
