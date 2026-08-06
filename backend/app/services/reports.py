"""Period report aggregation for archive-style PDF exports."""

from __future__ import annotations

from calendar import monthrange
from collections import defaultdict
from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy.orm import Session

from app.models import Party, Person
from app.services.amounts import is_income, is_one_time
from app.services.cost_history import unsigned_contribution_in_month
from app.services.analytics import AnalyticsService

PERIOD_TYPES = {"month", "quarter", "half", "year", "custom"}

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


def _month_start(value: date) -> date:
    return date(value.year, value.month, 1)


def _add_months(value: date, months: int) -> date:
    year = value.year + (value.month - 1 + months) // 12
    month = (value.month - 1 + months) % 12 + 1
    return date(year, month, 1)


def _month_end(value: date) -> date:
    last = monthrange(value.year, value.month)[1]
    return date(value.year, value.month, last)


def months_between(start: date, end: date, *, through: date | None = None) -> list[date]:
    """Inclusive month starts from start..end, capped at `through`."""
    through = through or date.today()
    start = _month_start(start)
    end = _month_start(end)
    cap = _month_start(through)
    if end > cap:
        end = cap
    if start > end:
        return []
    months: list[date] = []
    cursor = start
    while cursor <= end:
        months.append(cursor)
        cursor = _add_months(cursor, 1)
    return months


def resolve_period(
    *,
    period_type: str,
    year: int | None = None,
    month: int | None = None,
    quarter: int | None = None,
    half: int | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
) -> tuple[list[date], str, date, date]:
    """Return (months, label, range_start, range_end)."""
    if period_type not in PERIOD_TYPES:
        raise ValueError(
            f"Ungültiger period_type. Erlaubt: {', '.join(sorted(PERIOD_TYPES))}"
        )

    today = date.today()
    selected_year = year or today.year

    if period_type == "month":
        if month is None or month < 1 or month > 12:
            raise ValueError("Für period_type=month ist month (1–12) erforderlich")
        start = date(selected_year, month, 1)
        end = _month_end(start)
        label = f"{MONTH_NAMES_DE[month]} {selected_year}"
    elif period_type == "quarter":
        if quarter is None or quarter < 1 or quarter > 4:
            raise ValueError("Für period_type=quarter ist quarter (1–4) erforderlich")
        start_month = (quarter - 1) * 3 + 1
        start = date(selected_year, start_month, 1)
        end = _month_end(_add_months(start, 2))
        label = f"{quarter}. Quartal {selected_year}"
    elif period_type == "half":
        if half is None or half not in (1, 2):
            raise ValueError("Für period_type=half ist half (1 oder 2) erforderlich")
        start_month = 1 if half == 1 else 7
        start = date(selected_year, start_month, 1)
        end = _month_end(_add_months(start, 5))
        label = f"{half}. Halbjahr {selected_year}"
    elif period_type == "year":
        start = date(selected_year, 1, 1)
        end = date(selected_year, 12, 31)
        label = f"Jahr {selected_year}"
    else:  # custom
        if date_from is None or date_to is None:
            raise ValueError("Für period_type=custom sind date_from und date_to erforderlich")
        if date_to < date_from:
            raise ValueError("date_to muss nach date_from liegen")
        start = date_from
        end = date_to
        label = f"{date_from.isoformat()} – {date_to.isoformat()}"

    months = months_between(start, end, through=today)
    if not months:
        raise ValueError("Für diesen Zeitraum liegen noch keine auswertbaren Monate vor")
    return months, label, start, end


class ReportService:
    def __init__(self, db: Session):
        self.db = db
        self.analytics = AnalyticsService(db)

    def build_report(
        self,
        *,
        period_type: str,
        year: int | None = None,
        month: int | None = None,
        quarter: int | None = None,
        half: int | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
        object_id: int | None = None,
        person_id: int | None = None,
        party_id: int | None = None,
        household: bool = False,
        category_id: int | None = None,
        tag_id: int | None = None,
        comment: str | None = None,
    ) -> dict:
        self.analytics._validate_share_filters(
            person_id=person_id, party_id=party_id, household=household
        )
        months, label, range_start, range_end = resolve_period(
            period_type=period_type,
            year=year,
            month=month,
            quarter=quarter,
            half=half,
            date_from=date_from,
            date_to=date_to,
        )

        items = self.analytics._load_items_for_charts(
            object_id=object_id, category_id=category_id, tag_id=tag_id
        )
        person_party = self.analytics._person_party_map()
        person_names = {p.id: p.name for p in self.db.query(Person).all()}
        party_names = {p.id: p.name for p in self.db.query(Party).all()}

        expense_total = Decimal("0.00")
        income_total = Decimal("0.00")
        one_time_expense = Decimal("0.00")
        one_time_income = Decimal("0.00")
        by_category: dict[tuple[int | None, str], Decimal] = defaultdict(
            lambda: Decimal("0.00")
        )
        by_object: dict[tuple[int | None, str], Decimal] = defaultdict(
            lambda: Decimal("0.00")
        )
        by_person: dict[str, Decimal] = defaultdict(lambda: Decimal("0.00"))
        by_party: dict[str, Decimal] = defaultdict(lambda: Decimal("0.00"))
        item_totals: dict[tuple[int, str], Decimal] = defaultdict(lambda: Decimal("0.00"))
        monthly_series: list[dict] = []
        included: set[int] = set()

        for month_start in months:
            month_expense = Decimal("0.00")
            month_income = Decimal("0.00")
            for item in items:
                factor = self.analytics._share_factor(
                    item,
                    person_id=person_id,
                    party_id=party_id,
                    household=household,
                    person_party=person_party,
                )
                if factor is None:
                    continue
                history = sorted(item.price_history, key=lambda h: (h.valid_from, h.id))
                amount = (
                    unsigned_contribution_in_month(item, month_start, history) * factor
                ).quantize(Decimal("0.01"))
                if amount == 0:
                    continue
                included.add(item.id)

                if is_one_time(item):
                    if is_income(item):
                        one_time_income += amount
                        income_total += amount
                        month_income += amount
                    else:
                        one_time_expense += amount
                        expense_total += amount
                        month_expense += amount
                    continue

                if is_income(item):
                    income_total += amount
                    month_income += amount
                    continue

                expense_total += amount
                month_expense += amount
                item_totals[(item.id, item.name)] += amount
                cat_key = (
                    item.category_id,
                    item.category.name if item.category else "Unbekannt",
                )
                by_category[cat_key] += amount
                if item.object:
                    by_object[(item.object.id, item.object.name)] += amount
                else:
                    by_object[(None, "Ohne Objekt")] += amount

                # person / party rollup like dashboard
                if item.allocations:
                    for alloc in item.allocations:
                        share = (
                            amount * Decimal(alloc.percentage) / Decimal("100")
                        ).quantize(Decimal("0.01"))
                        if alloc.is_household:
                            by_person["Haushalt"] += share
                        elif alloc.person_id and alloc.person_id in person_names:
                            by_person[person_names[alloc.person_id]] += share
                            mapped = person_party.get(alloc.person_id)
                            if mapped and mapped in party_names:
                                by_party[party_names[mapped]] += share
                        elif alloc.party_id and alloc.party_id in party_names:
                            by_party[party_names[alloc.party_id]] += share
                elif item.object and item.object.person_id and item.object.person_id in person_names:
                    by_person[person_names[item.object.person_id]] += amount
                    mapped = person_party.get(item.object.person_id)
                    if mapped and mapped in party_names:
                        by_party[party_names[mapped]] += amount
                elif item.object and item.object.party_id and item.object.party_id in party_names:
                    by_party[party_names[item.object.party_id]] += amount
                else:
                    by_person["Haushalt"] += amount

            monthly_series.append(
                {
                    "month": f"{month_start.year}-{month_start.month:02d}",
                    "label": f"{MONTH_NAMES_DE[month_start.month][:3]} {month_start.year}",
                    "expense": month_expense.quantize(Decimal("0.01")),
                    "income": month_income.quantize(Decimal("0.01")),
                    "net": (month_expense - month_income).quantize(Decimal("0.01")),
                }
            )

        def named_list(mapping: dict, *, with_id: bool = False) -> list[dict]:
            rows = []
            for key, amount in sorted(mapping.items(), key=lambda x: x[1], reverse=True):
                if amount <= 0:
                    continue
                if with_id:
                    rows.append(
                        {
                            "id": key[0],
                            "name": key[1],
                            "amount": amount.quantize(Decimal("0.01")),
                        }
                    )
                else:
                    rows.append({"name": key, "amount": amount.quantize(Decimal("0.01"))})
            return rows

        top_items = [
            {"id": iid, "name": name, "amount": amount.quantize(Decimal("0.01"))}
            for (iid, name), amount in sorted(
                item_totals.items(), key=lambda x: x[1], reverse=True
            )[:15]
        ]

        return {
            "title": "KostenPilot Periodenbericht",
            "period_type": period_type,
            "period_label": label,
            "date_from": range_start.isoformat(),
            "date_to": range_end.isoformat(),
            "months_covered": len(months),
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "comment": (comment or "").strip() or None,
            "summary": {
                "expense_total": expense_total.quantize(Decimal("0.01")),
                "income_total": income_total.quantize(Decimal("0.01")),
                "net_total": (expense_total - income_total).quantize(Decimal("0.01")),
                "one_time_expense": one_time_expense.quantize(Decimal("0.01")),
                "one_time_income": one_time_income.quantize(Decimal("0.01")),
                "active_items": len(included),
            },
            "by_category": named_list(by_category, with_id=True),
            "by_object": named_list(by_object, with_id=True),
            "by_person": named_list(by_person),
            "by_party": named_list(by_party),
            "top_items": top_items,
            "monthly_series": monthly_series,
        }
