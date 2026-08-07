"""Contract term / renewal date calculations."""

from __future__ import annotations

import calendar
from datetime import date, timedelta
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models import Contract


def add_months(value: date, months: int) -> date:
    if months < 0:
        raise ValueError("months must be >= 0")
    year = value.year + (value.month - 1 + months) // 12
    month = (value.month - 1 + months) % 12 + 1
    last_day = calendar.monthrange(year, month)[1]
    return date(year, month, min(value.day, last_day))


def initial_end_date(contract: Contract) -> date | None:
    """End of the first fixed term (start + initial_term_months), else stored end_date."""
    if contract.start_date and contract.initial_term_months:
        return add_months(contract.start_date, int(contract.initial_term_months))
    return contract.end_date


def sync_end_date(contract: Contract) -> date | None:
    """Persist derived end_date from start + initial term when possible."""
    derived = None
    if contract.start_date and contract.initial_term_months:
        derived = add_months(contract.start_date, int(contract.initial_term_months))
        contract.end_date = derived
    return derived or contract.end_date


def in_renewal_phase(contract: Contract, today: date | None = None) -> bool:
    today = today or date.today()
    initial_end = initial_end_date(contract)
    if not initial_end or not contract.auto_renewal:
        return False
    return today >= initial_end


def current_period_end(contract: Contract, today: date | None = None) -> date | None:
    """
    Next relevant period end:
    - before/on initial term: initial end
    - after auto-renewal: end of the current/next renewal slice
    """
    today = today or date.today()
    initial_end = initial_end_date(contract)
    if not initial_end:
        return None
    if today < initial_end or not contract.auto_renewal:
        return initial_end

    renewal_months = int(contract.renewal_term_months or 1)
    if renewal_months < 1:
        renewal_months = 1
    end = initial_end
    # Advance period ends until strictly after today (upcoming boundary).
    # If today is exactly a period end, that end still counts as "today".
    guard = 0
    while end < today and guard < 2400:
        end = add_months(end, renewal_months)
        guard += 1
    if end < today:
        end = add_months(end, renewal_months)
    return end


def active_notice_period_days(contract: Contract, today: date | None = None) -> int | None:
    today = today or date.today()
    if in_renewal_phase(contract, today):
        if contract.renewal_notice_period_days is not None:
            return int(contract.renewal_notice_period_days)
    if contract.notice_period_days is not None:
        return int(contract.notice_period_days)
    return None


def notice_deadline(contract: Contract, today: date | None = None) -> date | None:
    today = today or date.today()
    period_end = current_period_end(contract, today)
    days = active_notice_period_days(contract, today)
    if period_end is None or days is None or days < 0:
        return None
    return period_end - timedelta(days=days)


def contract_view(contract: Contract, today: date | None = None) -> dict:
    today = today or date.today()
    initial_end = initial_end_date(contract)
    return {
        "initial_end_date": initial_end,
        "current_period_end": current_period_end(contract, today),
        "current_notice_deadline": notice_deadline(contract, today),
        "in_renewal": in_renewal_phase(contract, today),
        "active_notice_period_days": active_notice_period_days(contract, today),
    }
