from datetime import date

from app.models import CostItem, PaymentInterval
from app.services.due_dates import format_due_label, needs_due_month, next_due_sort_key


def test_needs_due_month():
    assert needs_due_month(PaymentInterval.monthly) is False
    assert needs_due_month(PaymentInterval.annual) is True
    assert needs_due_month(PaymentInterval.quarterly) is True
    assert needs_due_month(PaymentInterval.one_time) is False


def test_format_due_label_monthly():
    assert format_due_label(15, None) == "jeden 15."


def test_format_due_label_annual():
    assert format_due_label(1, 3) == "01. März"


def test_next_due_sort_key_annual():
    item = CostItem(
        name="Test",
        category_id=1,
        amount=100,
        currency="EUR",
        payment_interval=PaymentInterval.annual,
        due_day=1,
        due_month=3,
    )
    key = next_due_sort_key(item, today=date(2026, 8, 6))
    assert key == (2027, 3, 1)

    key_before = next_due_sort_key(item, today=date(2026, 2, 1))
    assert key_before == (2026, 3, 1)
