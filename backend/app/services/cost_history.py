from __future__ import annotations

from calendar import monthrange
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy.orm import Session, joinedload

from app.models import (
    CostHistoryEvent,
    CostItem,
    ObjectEntity,
    Person,
    PriceHistory,
    Tag,
)
from app.services.amounts import monthly_amount


def _month_start(value: date) -> date:
    return date(value.year, value.month, 1)


def _add_months(value: date, months: int) -> date:
    year = value.year + (value.month - 1 + months) // 12
    month = (value.month - 1 + months) % 12 + 1
    day = min(value.day, monthrange(year, month)[1])
    return date(year, month, day)


def _month_label(value: date) -> str:
    return f"{value.year}-{value.month:02d}"


def record_price_history(
    db: Session,
    item: CostItem,
    *,
    event_type: CostHistoryEvent,
    valid_from: date | None = None,
    notes: str | None = None,
    force_zero: bool = False,
) -> PriceHistory:
    """Append a history point for a cost item."""
    when = valid_from or date.today()
    amount = Decimal("0.00") if force_zero else Decimal(item.amount)
    monthly = Decimal("0.00") if force_zero else monthly_amount(item)

    # Avoid duplicate same-day unchanged entries for the same event.
    latest = (
        db.query(PriceHistory)
        .filter(PriceHistory.cost_item_id == item.id)
        .order_by(PriceHistory.valid_from.desc(), PriceHistory.id.desc())
        .first()
    )
    if (
        latest
        and latest.valid_from == when
        and latest.event_type == event_type
        and Decimal(latest.monthly_amount) == monthly
        and Decimal(latest.amount) == amount
    ):
        return latest

    entry = PriceHistory(
        cost_item_id=item.id,
        amount=amount,
        monthly_amount=monthly,
        valid_from=when,
        event_type=event_type,
        notes=notes,
    )
    db.add(entry)
    db.flush()
    return entry


def ensure_item_history(db: Session, item: CostItem) -> None:
    """Create an initial history point if the item has none."""
    exists = (
        db.query(PriceHistory.id).filter(PriceHistory.cost_item_id == item.id).first()
    )
    if exists:
        return
    start = item.start_date or (item.created_at.date() if item.created_at else date.today())
    event = CostHistoryEvent.created if item.is_active else CostHistoryEvent.ended
    record_price_history(
        db,
        item,
        event_type=event,
        valid_from=start,
        notes="Initialer Verlaufseintrag",
        force_zero=not item.is_active,
    )


def backfill_missing_history(db: Session) -> None:
    items = db.query(CostItem).all()
    for item in items:
        ensure_item_history(db, item)
    db.commit()


def _matches_share(
    item: CostItem,
    *,
    person_id: int | None,
    party_id: int | None,
    household: bool,
    person_party: dict[int, int | None],
) -> Decimal | None:
    """Return share factor for filtered timeline, None if excluded."""
    if person_id is None and party_id is None and not household:
        return Decimal("1")

    allocations = list(item.allocations)
    if party_id is not None:
        matched = Decimal("0")
        for alloc in allocations:
            pct = Decimal(alloc.percentage) / Decimal("100")
            if alloc.party_id == party_id:
                matched += pct
            elif alloc.person_id is not None and person_party.get(alloc.person_id) == party_id:
                matched += pct
        if matched > 0:
            return min(matched, Decimal("1"))
        object_party = item.object.party_id if item.object else None
        if object_party == party_id:
            return Decimal("1") if not allocations else None
        object_person = item.object.person_id if item.object else None
        if object_person is not None and person_party.get(object_person) == party_id:
            return Decimal("1") if not allocations else None
        return None

    if person_id is not None:
        matched = Decimal("0")
        for alloc in allocations:
            if alloc.person_id == person_id:
                matched += Decimal(alloc.percentage) / Decimal("100")
        if matched > 0:
            return min(matched, Decimal("1"))
        if item.object and item.object.person_id == person_id:
            return Decimal("1") if not allocations else None
        return None

    # household
    if not allocations:
        return Decimal("1")
    for alloc in allocations:
        if alloc.is_household:
            return Decimal(alloc.percentage) / Decimal("100")
    return None


def _active_monthly_on(
    item: CostItem,
    month: date,
    history: list[PriceHistory],
) -> Decimal:
    """Monthly amount of item at month start based on history timeline."""
    month = _month_start(month)
    if item.start_date and _month_start(item.start_date) > month:
        return Decimal("0.00")
    if item.end_date and _month_start(item.end_date) < month:
        return Decimal("0.00")

    applicable: PriceHistory | None = None
    for entry in history:
        if entry.valid_from <= _add_months(month, 1) - timedelta(days=1):
            # entry valid if its valid_from is on/before end of this month
            if _month_start(entry.valid_from) <= month:
                applicable = entry
        else:
            break

    if applicable is None:
        # No history yet for this month: treat inactive as 0, else current
        if not item.is_active:
            return Decimal("0.00")
        created = item.created_at.date() if item.created_at else date.today()
        if _month_start(created) > month:
            return Decimal("0.00")
        return monthly_amount(item)

    if applicable.event_type == CostHistoryEvent.ended:
        return Decimal("0.00")
    return Decimal(applicable.monthly_amount)


def cost_history_timeline(
    db: Session,
    *,
    months_back: int = 12,
    forecast_months: int = 6,
    object_id: int | None = None,
    category_id: int | None = None,
    tag_id: int | None = None,
    person_id: int | None = None,
    party_id: int | None = None,
    household: bool = False,
) -> dict:
    today = date.today()
    start = _month_start(_add_months(today, -max(months_back - 1, 0)))
    end_actual = _month_start(today)
    end_forecast = _month_start(_add_months(today, max(forecast_months, 0)))

    query = (
        db.query(CostItem)
        .options(
            joinedload(CostItem.allocations),
            joinedload(CostItem.tags),
            joinedload(CostItem.object).joinedload(ObjectEntity.party),
            joinedload(CostItem.object).joinedload(ObjectEntity.person),
            joinedload(CostItem.price_history),
            joinedload(CostItem.category),
        )
    )
    if object_id is not None:
        query = query.filter(CostItem.object_id == object_id)
    if category_id is not None:
        query = query.filter(CostItem.category_id == category_id)
    if tag_id is not None:
        query = query.filter(CostItem.tags.any(Tag.id == tag_id))

    items = query.all()
    persons = db.query(Person).all()
    person_party = {p.id: p.party_id for p in persons}

    filtered: list[tuple[CostItem, Decimal]] = []
    for item in items:
        factor = _matches_share(
            item,
            person_id=person_id,
            party_id=party_id,
            household=household,
            person_party=person_party,
        )
        if factor is None:
            continue
        ensure_item_history(db, item)
        filtered.append((item, factor))
    db.flush()

    # Reload histories after potential backfill
    for item, _ in filtered:
        db.refresh(item, attribute_names=["price_history"])

    points: list[dict] = []
    month = start
    while month <= end_forecast:
        is_forecast = month > end_actual
        total = Decimal("0.00")
        if not is_forecast:
            for item, factor in filtered:
                history = sorted(item.price_history, key=lambda h: (h.valid_from, h.id))
                total += (_active_monthly_on(item, month, history) * factor).quantize(
                    Decimal("0.01")
                )
            points.append(
                {
                    "month": _month_label(month),
                    "date": month.isoformat(),
                    "monthly_total": total,
                    "is_forecast": False,
                }
            )
        month = _add_months(month, 1)

    actual_values = [Decimal(str(p["monthly_total"])) for p in points if not p["is_forecast"]]
    forecast_points: list[dict] = []
    if forecast_months > 0 and len(actual_values) >= 2:
        # Simple linear regression on actual months
        n = len(actual_values)
        x_mean = (n - 1) / 2
        y_mean = sum(actual_values) / Decimal(n)
        num = Decimal("0")
        den = Decimal("0")
        for i, y in enumerate(actual_values):
            dx = Decimal(i) - Decimal(str(x_mean))
            num += dx * (y - y_mean)
            den += dx * dx
        slope = (num / den) if den != 0 else Decimal("0")
        intercept = y_mean - slope * Decimal(str(x_mean))
        last_idx = n - 1
        month = _add_months(end_actual, 1)
        for step in range(1, forecast_months + 1):
            predicted = intercept + slope * Decimal(last_idx + step)
            if predicted < 0:
                predicted = Decimal("0.00")
            predicted = predicted.quantize(Decimal("0.01"))
            forecast_points.append(
                {
                    "month": _month_label(month),
                    "date": month.isoformat(),
                    "monthly_total": predicted,
                    "is_forecast": True,
                }
            )
            month = _add_months(month, 1)
    elif forecast_months > 0 and actual_values:
        # Flat forecast from last known value
        last = actual_values[-1]
        month = _add_months(end_actual, 1)
        for _ in range(forecast_months):
            forecast_points.append(
                {
                    "month": _month_label(month),
                    "date": month.isoformat(),
                    "monthly_total": last,
                    "is_forecast": True,
                }
            )
            month = _add_months(month, 1)

    series = points + forecast_points

    # Notable events in range
    events: list[dict] = []
    range_start = start
    for item, factor in filtered:
        for entry in sorted(item.price_history, key=lambda h: (h.valid_from, h.id)):
            if entry.valid_from < range_start:
                continue
            if entry.valid_from > today:
                continue
            monthly = (Decimal(entry.monthly_amount) * factor).quantize(Decimal("0.01"))
            events.append(
                {
                    "date": entry.valid_from.isoformat(),
                    "cost_item_id": item.id,
                    "cost_item_name": item.name,
                    "event_type": entry.event_type.value,
                    "amount": entry.amount,
                    "monthly_amount": monthly,
                    "notes": entry.notes,
                }
            )
    events.sort(key=lambda e: e["date"], reverse=True)

    first = Decimal(str(points[0]["monthly_total"])) if points else Decimal("0")
    last = Decimal(str(points[-1]["monthly_total"])) if points else Decimal("0")
    change = (last - first).quantize(Decimal("0.01"))
    change_pct = (
        ((change / first) * Decimal("100")).quantize(Decimal("0.1"))
        if first != 0
        else Decimal("0.0")
    )

    return {
        "series": series,
        "events": events[:50],
        "summary": {
            "current_monthly": last,
            "start_monthly": first,
            "change_monthly": change,
            "change_percent": change_pct,
            "active_items": sum(1 for item, _ in filtered if item.is_active),
            "months_back": months_back,
            "forecast_months": forecast_months,
        },
    }
