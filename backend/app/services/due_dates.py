from datetime import date

from app.models import CostItem, PaymentInterval

MONTHLY_ONLY_INTERVALS = {PaymentInterval.monthly, PaymentInterval.bimonthly}

MONTH_NAMES_DE = {
    1: "Januar",
    2: "Februar",
    3: "März",
    4: "April",
    5: "Mai",
    6: "Juni",
    7: "Juli",
    8: "August",
    9: "September",
    10: "Oktober",
    11: "November",
    12: "Dezember",
}


def needs_due_month(interval: PaymentInterval) -> bool:
    return interval not in MONTHLY_ONLY_INTERVALS


def format_due_label(due_day: int | None, due_month: int | None) -> str:
    if due_day is None:
        return "–"
    if due_month is not None:
        month = MONTH_NAMES_DE.get(due_month, str(due_month))
        return f"{due_day:02d}. {month}"
    return f"jeden {due_day}."


def next_due_sort_key(item: CostItem, today: date | None = None) -> tuple[int, int, int]:
    """Sort key for upcoming dues: (year_offset, month, day)."""
    today = today or date.today()
    day = item.due_day or 31
    if item.due_month is not None:
        month = item.due_month
        candidate = date(today.year, month, min(day, 28))
        # Prefer real day when valid
        try:
            candidate = date(today.year, month, day)
        except ValueError:
            candidate = date(today.year, month, 28)
        if candidate < today:
            try:
                candidate = date(today.year + 1, month, day)
            except ValueError:
                candidate = date(today.year + 1, month, 28)
        return (candidate.year, candidate.month, candidate.day)
    # Monthly-style: next occurrence of day in current/next month
    if day >= today.day:
        return (today.year, today.month, day)
    if today.month == 12:
        return (today.year + 1, 1, day)
    return (today.year, today.month + 1, day)
