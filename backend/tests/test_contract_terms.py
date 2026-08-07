"""Unit tests for contract term / renewal calculations."""

from datetime import date

from app.models import Contract
from app.services.contract_terms import (
    active_notice_period_days,
    add_months,
    current_period_end,
    in_renewal_phase,
    initial_end_date,
    notice_deadline,
    sync_end_date,
)


def test_add_months_clamps_day():
    assert add_months(date(2024, 1, 31), 1) == date(2024, 2, 29)
    assert add_months(date(2025, 1, 15), 24) == date(2027, 1, 15)


def test_initial_end_from_term():
    contract = Contract(
        cost_item_id=1,
        provider="X",
        start_date=date(2024, 3, 1),
        initial_term_months=24,
        end_date=date(2099, 1, 1),
    )
    assert initial_end_date(contract) == date(2026, 3, 1)
    sync_end_date(contract)
    assert contract.end_date == date(2026, 3, 1)


def test_notice_before_renewal_uses_initial_notice():
    """24 months initial, 90-day notice; deadline is initial_end - 90."""
    contract = Contract(
        cost_item_id=1,
        provider="X",
        start_date=date(2024, 1, 1),
        initial_term_months=24,
        end_date=date(2026, 1, 1),
        notice_period_days=90,
        auto_renewal=True,
        renewal_term_months=1,
        renewal_notice_period_days=30,
    )
    today = date(2025, 6, 1)
    assert in_renewal_phase(contract, today) is False
    assert current_period_end(contract, today) == date(2026, 1, 1)
    assert active_notice_period_days(contract, today) == 90
    assert notice_deadline(contract, today) == date(2025, 10, 3)


def test_renewal_phase_monthly_notice():
    """After 24mo term: renew 1 month with 30-day notice."""
    contract = Contract(
        cost_item_id=1,
        provider="X",
        start_date=date(2024, 1, 1),
        initial_term_months=24,
        end_date=date(2026, 1, 1),
        notice_period_days=90,
        auto_renewal=True,
        renewal_term_months=1,
        renewal_notice_period_days=30,
    )
    # Mid first renewal month (Jan 2026 → Feb 2026)
    today = date(2026, 1, 15)
    assert in_renewal_phase(contract, today) is True
    assert current_period_end(contract, today) == date(2026, 2, 1)
    assert active_notice_period_days(contract, today) == 30
    assert notice_deadline(contract, today) == date(2026, 1, 2)

    # Later renewal slice
    today2 = date(2026, 4, 10)
    assert current_period_end(contract, today2) == date(2026, 5, 1)
    assert notice_deadline(contract, today2) == date(2026, 4, 1)


def test_no_auto_renewal_stays_on_initial_end():
    contract = Contract(
        cost_item_id=1,
        provider="X",
        start_date=date(2024, 1, 1),
        initial_term_months=12,
        end_date=date(2025, 1, 1),
        notice_period_days=30,
        auto_renewal=False,
    )
    today = date(2025, 6, 1)
    assert in_renewal_phase(contract, today) is False
    assert current_period_end(contract, today) == date(2025, 1, 1)
