from collections import defaultdict
from datetime import date
from decimal import Decimal

from sqlalchemy.orm import Session, joinedload

from app.models import (
    Category,
    Contract,
    CostAllocation,
    CostItem,
    EntryType,
    ObjectEntity,
    Party,
    PaymentInterval,
    Person,
    Tag,
)
from app.schemas import DashboardSummary, NamedAmount, UpcomingDue
from app.services.amounts import is_income, is_one_time, monthly_amount, yearly_amount
from app.services.cost_history import (
    ensure_item_history,
    months_in_year,
    unsigned_contribution_in_month,
)
from app.services.due_dates import format_due_label, next_due_sort_key

INTERVAL_LABELS_DE = {
    PaymentInterval.monthly: "Monatlich",
    PaymentInterval.bimonthly: "Zweimonatlich",
    PaymentInterval.quarterly: "Vierteljährlich",
    PaymentInterval.semiannual: "Halbjährlich",
    PaymentInterval.annual: "Jährlich",
    PaymentInterval.custom: "Individuell",
    PaymentInterval.one_time: "Einmalig",
}

ENTRY_TYPE_LABELS_DE = {
    EntryType.expense: "Ausgabe",
    EntryType.income: "Einnahme",
}

BREAKDOWN_GROUPS = {"category", "person", "object", "tag", "party"}
HIERARCHY_MODES = {"category", "structure"}


class AnalyticsService:
    def __init__(self, db: Session):
        self.db = db

    def filter_options(self) -> dict:
        persons = (
            self.db.query(Person)
            .filter(Person.is_active.is_(True))
            .order_by(Person.name)
            .all()
        )
        parties = (
            self.db.query(Party).filter(Party.is_active.is_(True)).order_by(Party.name).all()
        )
        objects = (
            self.db.query(ObjectEntity)
            .filter(ObjectEntity.is_active.is_(True))
            .order_by(ObjectEntity.name)
            .all()
        )
        categories = self.db.query(Category).order_by(Category.sort_order, Category.name).all()
        tags = self.db.query(Tag).order_by(Tag.name).all()
        today = date.today()
        years = {today.year - offset for offset in range(0, 6)}
        for (start,) in self.db.query(CostItem.start_date).filter(CostItem.start_date.isnot(None)):
            years.add(start.year)
        return {
            "persons": [
                {"id": p.id, "name": p.name, "party_id": p.party_id} for p in persons
            ],
            "parties": [{"id": p.id, "name": p.name} for p in parties],
            "objects": [
                {
                    "id": o.id,
                    "name": o.name,
                    "party_id": o.party_id,
                    "person_id": o.person_id,
                }
                for o in objects
            ],
            "categories": [{"id": c.id, "name": c.name} for c in categories],
            "tags": [{"id": t.id, "name": t.name} for t in tags],
            "years": sorted(years, reverse=True),
        }

    def _person_objects(self, person_id: int, objects: list[ObjectEntity]) -> list[dict]:
        return [
            {"id": o.id, "name": o.name, "type": "object", "objects": []}
            for o in objects
            if o.person_id == person_id
        ]

    def structure(self) -> dict:
        """Public organigram data: parties with persons/objects plus unassigned."""
        parties = (
            self.db.query(Party).filter(Party.is_active.is_(True)).order_by(Party.name).all()
        )
        persons = (
            self.db.query(Person).filter(Person.is_active.is_(True)).order_by(Person.name).all()
        )
        objects = (
            self.db.query(ObjectEntity)
            .filter(ObjectEntity.is_active.is_(True))
            .order_by(ObjectEntity.name)
            .all()
        )

        party_nodes = []
        for party in parties:
            party_persons = [
                {
                    "id": p.id,
                    "name": p.name,
                    "type": "person",
                    "objects": self._person_objects(p.id, objects),
                }
                for p in persons
                if p.party_id == party.id
            ]
            party_objects = [
                {"id": o.id, "name": o.name, "type": "object", "objects": []}
                for o in objects
                if o.party_id == party.id
            ]
            party_nodes.append(
                {
                    "id": party.id,
                    "name": party.name,
                    "description": party.description,
                    "persons": party_persons,
                    "objects": party_objects,
                }
            )

        unassigned_persons = [
            {
                "id": p.id,
                "name": p.name,
                "type": "person",
                "objects": self._person_objects(p.id, objects),
            }
            for p in persons
            if p.party_id is None
        ]
        unassigned_objects = [
            {"id": o.id, "name": o.name, "type": "object", "objects": []}
            for o in objects
            if o.party_id is None and o.person_id is None
        ]

        return {
            "root_name": "Haushalt",
            "parties": party_nodes,
            "unassigned_persons": unassigned_persons,
            "unassigned_objects": unassigned_objects,
        }

    def cost_overview(self) -> list[dict]:
        """Public tabular overview of all active cost items with related details."""
        items = (
            self.db.query(CostItem)
            .options(
                joinedload(CostItem.allocations).joinedload(CostAllocation.person),
                joinedload(CostItem.allocations).joinedload(CostAllocation.party),
                joinedload(CostItem.category),
                joinedload(CostItem.tags),
                joinedload(CostItem.object).joinedload(ObjectEntity.party),
                joinedload(CostItem.object).joinedload(ObjectEntity.person),
                joinedload(CostItem.contract),
            )
            .filter(CostItem.is_active.is_(True))
            .order_by(CostItem.name)
            .all()
        )

        rows: list[dict] = []
        for item in items:
            allocation_parts: list[str] = []
            for alloc in item.allocations:
                if alloc.is_household:
                    target = "Haushalt"
                elif alloc.party is not None:
                    target = f"Partei: {alloc.party.name}"
                elif alloc.person is not None:
                    target = f"Person: {alloc.person.name}"
                else:
                    target = "Unbekannt"
                allocation_parts.append(f"{target} {float(alloc.percentage):g} %")

            contract = item.contract
            tag_names = sorted(tag.name for tag in item.tags)
            related_person_ids: set[int] = set()
            for alloc in item.allocations:
                if alloc.person_id:
                    related_person_ids.add(alloc.person_id)
            if item.object and item.object.person_id:
                has_person_alloc = any(a.person_id for a in item.allocations)
                if not item.allocations or not has_person_alloc:
                    related_person_ids.add(item.object.person_id)

            rows.append(
                {
                    "id": item.id,
                    "name": item.name,
                    "description": item.description,
                    "category": item.category.name if item.category else None,
                    "category_id": item.category_id,
                    "tags": ", ".join(tag_names) if tag_names else None,
                    "tag_ids": [tag.id for tag in item.tags],
                    "object": item.object.name if item.object else None,
                    "object_party": (
                        item.object.party.name
                        if item.object and item.object.party
                        else None
                    ),
                    "object_person": (
                        item.object.person.name
                        if item.object and item.object.person
                        else None
                    ),
                    "object_person_id": item.object.person_id if item.object else None,
                    "related_person_ids": sorted(related_person_ids),
                    "contract_partner": item.contract_partner,
                    "amount": item.amount,
                    "currency": item.currency,
                    "entry_type": item.entry_type.value,
                    "entry_type_label": ENTRY_TYPE_LABELS_DE.get(
                        item.entry_type, item.entry_type.value
                    ),
                    "payment_interval": item.payment_interval.value,
                    "payment_interval_label": INTERVAL_LABELS_DE.get(
                        item.payment_interval, item.payment_interval.value
                    ),
                    "monthly_amount": monthly_amount(item),
                    "yearly_amount": yearly_amount(item),
                    "due_label": (
                        item.start_date.isoformat()
                        if is_one_time(item) and item.start_date
                        else format_due_label(item.due_day, item.due_month)
                    ),
                    "due_day": item.due_day,
                    "due_month": item.due_month,
                    "allocations": ", ".join(allocation_parts) if allocation_parts else "Haushalt 100 %",
                    "contract_provider": contract.provider if contract else None,
                    "contract_number": contract.contract_number if contract else None,
                    "contract_notice_days": contract.notice_period_days if contract else None,
                    "contract_auto_renewal": contract.auto_renewal if contract else None,
                    "contract_start": contract.start_date if contract else None,
                    "contract_end": contract.end_date if contract else None,
                    "notes": item.notes,
                    "start_date": item.start_date,
                    "end_date": item.end_date,
                }
            )
        return rows

    def _party_share_factor(
        self,
        item: CostItem,
        party_id: int,
        person_party: dict[int, int | None],
    ) -> Decimal | None:
        """Roll up party + its persons + owned objects into one share factor."""
        allocations = list(item.allocations)
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
            if not allocations:
                return Decimal("1")
            household = sum(
                (Decimal(a.percentage) / Decimal("100") for a in allocations if a.is_household),
                Decimal("0"),
            )
            return household if household > 0 else None

        object_person = item.object.person_id if item.object else None
        if object_person is not None and person_party.get(object_person) == party_id:
            if not allocations:
                return Decimal("1")
            household = sum(
                (Decimal(a.percentage) / Decimal("100") for a in allocations if a.is_household),
                Decimal("0"),
            )
            return household if household > 0 else None

        return None

    def _person_share_factor(
        self,
        item: CostItem,
        person_id: int,
    ) -> Decimal | None:
        """Roll up direct person shares and objects owned by the person."""
        allocations = list(item.allocations)
        matched = Decimal("0")

        for alloc in allocations:
            pct = Decimal(alloc.percentage) / Decimal("100")
            if alloc.person_id == person_id:
                matched += pct

        if matched > 0:
            return min(matched, Decimal("1"))

        object_person = item.object.person_id if item.object else None
        if object_person == person_id:
            if not allocations:
                return Decimal("1")
            household = sum(
                (Decimal(a.percentage) / Decimal("100") for a in allocations if a.is_household),
                Decimal("0"),
            )
            return household if household > 0 else None

        return None

    def _share_factor(
        self,
        item: CostItem,
        *,
        person_id: int | None,
        party_id: int | None,
        household: bool,
        person_party: dict[int, int | None],
    ) -> Decimal | None:
        if person_id is None and party_id is None and not household:
            return Decimal("1")

        if party_id is not None:
            return self._party_share_factor(item, party_id, person_party)

        if person_id is not None:
            return self._person_share_factor(item, person_id)

        allocations = list(item.allocations)
        if not allocations:
            return Decimal("1") if household else None

        for alloc in allocations:
            if household and alloc.is_household:
                return Decimal(alloc.percentage) / Decimal("100")
            if (
                person_id is not None
                and not alloc.is_household
                and alloc.person_id == person_id
            ):
                return Decimal(alloc.percentage) / Decimal("100")
        return None

    def dashboard_summary(
        self,
        *,
        year: int | None = None,
        object_id: int | None = None,
        person_id: int | None = None,
        party_id: int | None = None,
        household: bool = False,
        category_id: int | None = None,
        tag_id: int | None = None,
    ) -> DashboardSummary:
        filters_set = sum(
            [
                1 if person_id is not None else 0,
                1 if party_id is not None else 0,
                1 if household else 0,
            ]
        )
        if filters_set > 1:
            raise ValueError(
                "person_id, party_id und household können nicht gleichzeitig gesetzt sein"
            )

        today = date.today()
        selected_year = year or today.year
        if selected_year < 2000 or selected_year > today.year + 1:
            raise ValueError("Ungültiges Jahr")

        months = months_in_year(selected_year, through=today)
        if not months:
            raise ValueError("Für dieses Jahr liegen noch keine Daten vor")
        reference_month = months[-1]

        query = (
            self.db.query(CostItem)
            .options(
                joinedload(CostItem.allocations).joinedload(CostAllocation.person),
                joinedload(CostItem.allocations).joinedload(CostAllocation.party),
                joinedload(CostItem.category),
                joinedload(CostItem.tags),
                joinedload(CostItem.object),
                joinedload(CostItem.price_history),
            )
        )
        if object_id is not None:
            query = query.filter(CostItem.object_id == object_id)
        if category_id is not None:
            query = query.filter(CostItem.category_id == category_id)
        if tag_id is not None:
            query = query.filter(CostItem.tags.any(Tag.id == tag_id))

        items = query.all()
        for item in items:
            ensure_item_history(self.db, item)
        self.db.flush()
        for item in items:
            self.db.refresh(item, attribute_names=["price_history"])

        persons = self.db.query(Person).all()
        person_names = {p.id: p.name for p in persons}
        person_party = {p.id: p.party_id for p in persons}
        party_names = {p.id: p.name for p in self.db.query(Party).all()}

        yearly_fixed = Decimal("0.00")
        yearly_income = Decimal("0.00")
        one_time_expense = Decimal("0.00")
        one_time_income = Decimal("0.00")
        by_person: dict[str, Decimal] = defaultdict(lambda: Decimal("0.00"))
        by_party: dict[str, Decimal] = defaultdict(lambda: Decimal("0.00"))
        by_object: dict[tuple[int | None, str], Decimal] = defaultdict(lambda: Decimal("0.00"))
        by_category: dict[tuple[int, str], Decimal] = defaultdict(lambda: Decimal("0.00"))
        top_items: list[tuple[int, str, Decimal]] = []
        included_ids: set[int] = set()
        reference_expense_ids: set[int] = set()

        def add_breakdown(item: CostItem, m: Decimal) -> None:
            cat_key = (item.category_id, item.category.name if item.category else "Unbekannt")
            by_category[cat_key] += m

            if item.object:
                by_object[(item.object.id, item.object.name)] += m
            else:
                by_object[(None, "Ohne Objekt")] += m

            if person_id is not None or party_id is not None or household:
                if household:
                    by_person["Haushalt"] += m
                elif person_id is not None:
                    by_person[person_names.get(person_id, "Unbekannt")] += m
                elif party_id is not None:
                    by_party[party_names.get(party_id, "Unbekannt")] += m
                return

            if item.allocations:
                for alloc in item.allocations:
                    share = (m * Decimal(alloc.percentage) / Decimal("100")).quantize(
                        Decimal("0.01")
                    )
                    if alloc.is_household:
                        by_person["Haushalt"] += share
                    elif alloc.person_id and alloc.person_id in person_names:
                        by_person[person_names[alloc.person_id]] += share
                        mapped_party = person_party.get(alloc.person_id)
                        if mapped_party and mapped_party in party_names:
                            by_party[party_names[mapped_party]] += share
                    elif alloc.party_id and alloc.party_id in party_names:
                        by_party[party_names[alloc.party_id]] += share
                    else:
                        by_person["Unbekannt"] += share
            elif item.object and item.object.person_id and item.object.person_id in person_names:
                by_person[person_names[item.object.person_id]] += m
                mapped_party = person_party.get(item.object.person_id)
                if mapped_party and mapped_party in party_names:
                    by_party[party_names[mapped_party]] += m
            elif item.object and item.object.party_id and item.object.party_id in party_names:
                by_party[party_names[item.object.party_id]] += m
            else:
                by_person["Haushalt"] += m

        for item in items:
            factor = self._share_factor(
                item,
                person_id=person_id,
                party_id=party_id,
                household=household,
                person_party=person_party,
            )
            if factor is None:
                continue

            history = sorted(item.price_history, key=lambda h: (h.valid_from, h.id))
            contributed = False

            for month in months:
                amount = (
                    unsigned_contribution_in_month(item, month, history) * factor
                ).quantize(Decimal("0.01"))
                if amount == 0:
                    continue
                contributed = True
                if is_one_time(item):
                    if is_income(item):
                        one_time_income += amount
                    else:
                        one_time_expense += amount
                elif is_income(item):
                    yearly_income += amount
                else:
                    yearly_fixed += amount

            if not contributed:
                continue

            included_ids.add(item.id)

            if is_one_time(item) or is_income(item):
                continue
            ref_amount = (
                unsigned_contribution_in_month(item, reference_month, history) * factor
            ).quantize(Decimal("0.01"))
            if ref_amount == 0:
                continue
            reference_expense_ids.add(item.id)
            top_items.append((item.id, item.name, ref_amount))
            add_breakdown(item, ref_amount)

        # Monthly KPIs = snapshot of the reference month (current/last month of year)
        monthly_fixed = Decimal("0.00")
        monthly_income_snap = Decimal("0.00")
        for item in items:
            factor = self._share_factor(
                item,
                person_id=person_id,
                party_id=party_id,
                household=household,
                person_party=person_party,
            )
            if factor is None or is_one_time(item):
                continue
            history = sorted(item.price_history, key=lambda h: (h.valid_from, h.id))
            amount = (
                unsigned_contribution_in_month(item, reference_month, history) * factor
            ).quantize(Decimal("0.01"))
            if amount == 0:
                continue
            if is_income(item):
                monthly_income_snap += amount
            else:
                monthly_fixed += amount

        monthly_net = (monthly_fixed - monthly_income_snap).quantize(Decimal("0.01"))
        # Jahres-KPIs: annualisierte Laufkosten (12 × Monatsstand)
        annualized_fixed = (monthly_fixed * Decimal("12")).quantize(Decimal("0.01"))
        annualized_income = (monthly_income_snap * Decimal("12")).quantize(Decimal("0.01"))
        annualized_net = (annualized_fixed - annualized_income).quantize(Decimal("0.01"))
        # Bisher im Jahr: Summe der monatlichen Beiträge (bereits in yearly_*)
        ytd_fixed = yearly_fixed.quantize(Decimal("0.01"))
        ytd_income_total = yearly_income.quantize(Decimal("0.01"))

        if included_ids:
            active_contracts = (
                self.db.query(Contract).filter(Contract.cost_item_id.in_(included_ids)).count()
            )
        else:
            active_contracts = 0

        upcoming: list[UpcomingDue] = []
        if selected_year == today.year:
            due_items = [
                item
                for item in items
                if item.id in reference_expense_ids
                and not is_one_time(item)
                and item.due_day is not None
                and item.is_active
            ]
            due_items.sort(key=next_due_sort_key)
            for item in due_items[:10]:
                factor = (
                    self._share_factor(
                        item,
                        person_id=person_id,
                        party_id=party_id,
                        household=household,
                        person_party=person_party,
                    )
                    or Decimal("1")
                )
                upcoming.append(
                    UpcomingDue(
                        cost_item_id=item.id,
                        name=item.name,
                        due_day=item.due_day,
                        due_month=item.due_month,
                        due_label=format_due_label(item.due_day, item.due_month),
                        amount=(monthly_amount(item) * factor).quantize(Decimal("0.01")),
                        payment_interval=item.payment_interval,
                        entry_type=item.entry_type,
                    )
                )

        top_items.sort(key=lambda t: t[2], reverse=True)

        return DashboardSummary(
            year=selected_year,
            monthly_fixed_costs=monthly_fixed.quantize(Decimal("0.01")),
            yearly_fixed_costs=annualized_fixed,
            monthly_income=monthly_income_snap.quantize(Decimal("0.01")),
            yearly_income=annualized_income,
            monthly_net=monthly_net,
            yearly_net=annualized_net,
            ytd_fixed_costs=ytd_fixed,
            ytd_income=ytd_income_total,
            one_time_expense=one_time_expense.quantize(Decimal("0.01")),
            one_time_income=one_time_income.quantize(Decimal("0.01")),
            active_contracts=active_contracts,
            active_cost_items=len(included_ids),
            costs_by_person=[
                NamedAmount(name=name, amount=amount.quantize(Decimal("0.01")))
                for name, amount in sorted(by_person.items(), key=lambda x: x[1], reverse=True)
            ],
            costs_by_party=[
                NamedAmount(name=name, amount=amount.quantize(Decimal("0.01")))
                for name, amount in sorted(by_party.items(), key=lambda x: x[1], reverse=True)
            ],
            costs_by_object=[
                NamedAmount(id=oid, name=name, amount=amount.quantize(Decimal("0.01")))
                for (oid, name), amount in sorted(by_object.items(), key=lambda x: x[1], reverse=True)
            ],
            costs_by_category=[
                NamedAmount(id=cid, name=name, amount=amount.quantize(Decimal("0.01")))
                for (cid, name), amount in sorted(by_category.items(), key=lambda x: x[1], reverse=True)
            ],
            top_cost_blocks=[
                NamedAmount(id=iid, name=name, amount=amount.quantize(Decimal("0.01")))
                for iid, name, amount in top_items
            ],
            upcoming_dues=upcoming,
        )

    def _validate_share_filters(
        self,
        *,
        person_id: int | None,
        party_id: int | None,
        household: bool,
    ) -> None:
        filters_set = sum(
            [
                1 if person_id is not None else 0,
                1 if party_id is not None else 0,
                1 if household else 0,
            ]
        )
        if filters_set > 1:
            raise ValueError(
                "person_id, party_id und household können nicht gleichzeitig gesetzt sein"
            )

    def _resolve_year(self, year: int | None) -> tuple[int, list[date], date]:
        today = date.today()
        selected_year = year or today.year
        if selected_year < 2000 or selected_year > today.year + 1:
            raise ValueError("Ungültiges Jahr")
        months = months_in_year(selected_year, through=today)
        if not months:
            raise ValueError("Für dieses Jahr liegen noch keine Daten vor")
        return selected_year, months, months[-1]

    def _load_items_for_charts(
        self,
        *,
        object_id: int | None = None,
        category_id: int | None = None,
        tag_id: int | None = None,
    ) -> list[CostItem]:
        query = (
            self.db.query(CostItem)
            .options(
                joinedload(CostItem.allocations).joinedload(CostAllocation.person),
                joinedload(CostItem.allocations).joinedload(CostAllocation.party),
                joinedload(CostItem.category),
                joinedload(CostItem.tags),
                joinedload(CostItem.object).joinedload(ObjectEntity.party),
                joinedload(CostItem.object).joinedload(ObjectEntity.person),
                joinedload(CostItem.price_history),
            )
        )
        if object_id is not None:
            query = query.filter(CostItem.object_id == object_id)
        if category_id is not None:
            query = query.filter(CostItem.category_id == category_id)
        if tag_id is not None:
            query = query.filter(CostItem.tags.any(Tag.id == tag_id))
        items = query.all()
        for item in items:
            ensure_item_history(self.db, item)
        self.db.flush()
        for item in items:
            self.db.refresh(item, attribute_names=["price_history"])
        return items

    def _person_party_map(self) -> dict[int, int | None]:
        return {p.id: p.party_id for p in self.db.query(Person).all()}

    def _iter_expense_snapshots(
        self,
        items: list[CostItem],
        *,
        reference_month: date,
        person_id: int | None,
        party_id: int | None,
        household: bool,
        person_party: dict[int, int | None],
    ):
        """Yield (item, amount) for recurring expenses in the reference month."""
        for item in items:
            if is_one_time(item) or is_income(item):
                continue
            factor = self._share_factor(
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
                unsigned_contribution_in_month(item, reference_month, history) * factor
            ).quantize(Decimal("0.01"))
            if amount == 0:
                continue
            yield item, amount

    def breakdown(
        self,
        *,
        group_by: str,
        year: int | None = None,
        object_id: int | None = None,
        person_id: int | None = None,
        party_id: int | None = None,
        household: bool = False,
        category_id: int | None = None,
        tag_id: int | None = None,
    ) -> dict:
        if group_by not in BREAKDOWN_GROUPS:
            raise ValueError(f"Ungültiges group_by. Erlaubt: {', '.join(sorted(BREAKDOWN_GROUPS))}")
        self._validate_share_filters(person_id=person_id, party_id=party_id, household=household)
        _, _, reference_month = self._resolve_year(year)
        items = self._load_items_for_charts(
            object_id=object_id, category_id=category_id, tag_id=tag_id
        )
        person_party = self._person_party_map()
        person_names = {p.id: p.name for p in self.db.query(Person).all()}
        party_names = {p.id: p.name for p in self.db.query(Party).all()}

        buckets: dict[tuple[int | None, str], Decimal] = defaultdict(lambda: Decimal("0.00"))

        for item, amount in self._iter_expense_snapshots(
            items,
            reference_month=reference_month,
            person_id=person_id,
            party_id=party_id,
            household=household,
            person_party=person_party,
        ):
            if group_by == "category":
                key = (item.category_id, item.category.name if item.category else "Unbekannt")
                buckets[key] += amount
            elif group_by == "object":
                if item.object:
                    buckets[(item.object.id, item.object.name)] += amount
                else:
                    buckets[(None, "Ohne Objekt")] += amount
            elif group_by == "tag":
                tags = list(item.tags)
                if not tags:
                    buckets[(None, "Ohne Tag")] += amount
                else:
                    share = (amount / Decimal(len(tags))).quantize(Decimal("0.01"))
                    for tag in tags:
                        buckets[(tag.id, tag.name)] += share
            elif group_by == "person":
                if item.allocations:
                    for alloc in item.allocations:
                        share = (amount * Decimal(alloc.percentage) / Decimal("100")).quantize(
                            Decimal("0.01")
                        )
                        if alloc.is_household:
                            buckets[(None, "Haushalt")] += share
                        elif alloc.person_id and alloc.person_id in person_names:
                            buckets[(alloc.person_id, person_names[alloc.person_id])] += share
                        elif alloc.party_id and alloc.party_id in party_names:
                            buckets[(None, f"Partei: {party_names[alloc.party_id]}")] += share
                elif item.object and item.object.person_id and item.object.person_id in person_names:
                    buckets[(item.object.person_id, person_names[item.object.person_id])] += amount
                else:
                    buckets[(None, "Haushalt")] += amount
            elif group_by == "party":
                if item.allocations:
                    for alloc in item.allocations:
                        share = (amount * Decimal(alloc.percentage) / Decimal("100")).quantize(
                            Decimal("0.01")
                        )
                        if alloc.party_id and alloc.party_id in party_names:
                            buckets[(alloc.party_id, party_names[alloc.party_id])] += share
                        elif alloc.person_id:
                            mapped = person_party.get(alloc.person_id)
                            if mapped and mapped in party_names:
                                buckets[(mapped, party_names[mapped])] += share
                            else:
                                buckets[(None, "Ohne Partei")] += share
                        elif alloc.is_household:
                            buckets[(None, "Haushalt")] += share
                elif item.object and item.object.party_id and item.object.party_id in party_names:
                    buckets[(item.object.party_id, party_names[item.object.party_id])] += amount
                elif item.object and item.object.person_id:
                    mapped = person_party.get(item.object.person_id)
                    if mapped and mapped in party_names:
                        buckets[(mapped, party_names[mapped])] += amount
                    else:
                        buckets[(None, "Ohne Partei")] += amount
                else:
                    buckets[(None, "Haushalt")] += amount

        return {
            "group_by": group_by,
            "items": [
                {"id": key[0], "name": key[1], "amount": amount.quantize(Decimal("0.01"))}
                for key, amount in sorted(buckets.items(), key=lambda x: x[1], reverse=True)
            ],
        }

    def hierarchy(
        self,
        *,
        mode: str = "category",
        year: int | None = None,
        object_id: int | None = None,
        person_id: int | None = None,
        party_id: int | None = None,
        household: bool = False,
        category_id: int | None = None,
        tag_id: int | None = None,
    ) -> dict:
        if mode not in HIERARCHY_MODES:
            raise ValueError(f"Ungültiger mode. Erlaubt: {', '.join(sorted(HIERARCHY_MODES))}")
        self._validate_share_filters(person_id=person_id, party_id=party_id, household=household)
        _, _, reference_month = self._resolve_year(year)
        items = self._load_items_for_charts(
            object_id=object_id, category_id=category_id, tag_id=tag_id
        )
        person_party = self._person_party_map()

        if mode == "category":
            cats: dict[int | None, dict] = {}
            for item, amount in self._iter_expense_snapshots(
                items,
                reference_month=reference_month,
                person_id=person_id,
                party_id=party_id,
                household=household,
                person_party=person_party,
            ):
                cid = item.category_id
                cname = item.category.name if item.category else "Unbekannt"
                if cid not in cats:
                    cats[cid] = {
                        "id": cid,
                        "name": cname,
                        "value": Decimal("0.00"),
                        "children": [],
                    }
                cats[cid]["children"].append(
                    {"id": item.id, "name": item.name, "value": amount}
                )
                cats[cid]["value"] += amount
            nodes = sorted(cats.values(), key=lambda n: n["value"], reverse=True)
            for node in nodes:
                node["value"] = node["value"].quantize(Decimal("0.01"))
                node["children"] = sorted(
                    node["children"], key=lambda c: c["value"], reverse=True
                )
            return {"mode": mode, "nodes": nodes}

        # structure: party → person → object (with costs rolled into leaves)
        party_names = {p.id: p.name for p in self.db.query(Party).all()}
        person_names = {p.id: p.name for p in self.db.query(Person).all()}
        roots: dict[str, dict] = {}

        def ensure(path: list[tuple[str, str]]) -> dict:
            """path = [(id_key, name), ...] under synthetic root."""
            current = roots
            node = None
            for key, name in path:
                if key not in current:
                    current[key] = {"id": key, "name": name, "value": Decimal("0.00"), "children": {}}
                node = current[key]
                current = node["children"]
            return node  # type: ignore[return-value]

        for item, amount in self._iter_expense_snapshots(
            items,
            reference_month=reference_month,
            person_id=person_id,
            party_id=party_id,
            household=household,
            person_party=person_party,
        ):
            party_key = "ohne_partei"
            party_label = "Ohne Partei"
            person_key = "ohne_person"
            person_label = "Ohne Person"
            object_key = f"item:{item.id}"
            object_label = item.name

            if item.object:
                object_key = f"object:{item.object.id}"
                object_label = item.object.name
                if item.object.party_id and item.object.party_id in party_names:
                    party_key = f"party:{item.object.party_id}"
                    party_label = party_names[item.object.party_id]
                if item.object.person_id and item.object.person_id in person_names:
                    person_key = f"person:{item.object.person_id}"
                    person_label = person_names[item.object.person_id]
                    mapped = person_party.get(item.object.person_id)
                    if mapped and mapped in party_names and party_key == "ohne_partei":
                        party_key = f"party:{mapped}"
                        party_label = party_names[mapped]

            leaf = ensure(
                [
                    (party_key, party_label),
                    (person_key, person_label),
                    (object_key, object_label),
                ]
            )
            leaf["value"] += amount
            party_node = roots[party_key]
            party_node["value"] += amount
            person_node = party_node["children"][person_key]
            person_node["value"] += amount

        def freeze(node_map: dict) -> list[dict]:
            result = []
            for node in sorted(node_map.values(), key=lambda n: n["value"], reverse=True):
                children = freeze(node["children"]) if isinstance(node["children"], dict) else []
                result.append(
                    {
                        "id": node["id"],
                        "name": node["name"],
                        "value": node["value"].quantize(Decimal("0.01")),
                        "children": children,
                    }
                )
            return result

        return {"mode": mode, "nodes": freeze(roots)}

    def heatmap(
        self,
        *,
        year: int | None = None,
        object_id: int | None = None,
        person_id: int | None = None,
        party_id: int | None = None,
        household: bool = False,
        category_id: int | None = None,
        tag_id: int | None = None,
    ) -> dict:
        self._validate_share_filters(person_id=person_id, party_id=party_id, household=household)
        selected_year, months, _ = self._resolve_year(year)
        items = self._load_items_for_charts(
            object_id=object_id, category_id=category_id, tag_id=tag_id
        )
        person_party = self._person_party_map()

        month_labels = [f"{m.year}-{m.month:02d}" for m in months]
        cat_totals: dict[str, list[Decimal]] = {}

        for item in items:
            if is_one_time(item) or is_income(item):
                continue
            factor = self._share_factor(
                item,
                person_id=person_id,
                party_id=party_id,
                household=household,
                person_party=person_party,
            )
            if factor is None:
                continue
            cat_name = item.category.name if item.category else "Unbekannt"
            if cat_name not in cat_totals:
                cat_totals[cat_name] = [Decimal("0.00") for _ in months]
            history = sorted(item.price_history, key=lambda h: (h.valid_from, h.id))
            for idx, month in enumerate(months):
                amount = (
                    unsigned_contribution_in_month(item, month, history) * factor
                ).quantize(Decimal("0.01"))
                cat_totals[cat_name][idx] += amount

        # drop empty categories
        categories = [
            name
            for name, series in sorted(
                cat_totals.items(),
                key=lambda kv: sum(kv[1], Decimal("0")),
                reverse=True,
            )
            if sum(series, Decimal("0")) > 0
        ]
        values = [
            [float(cat_totals[name][m_idx].quantize(Decimal("0.01"))) for m_idx in range(len(months))]
            for name in categories
        ]
        return {
            "year": selected_year,
            "categories": categories,
            "months": month_labels,
            "values": values,
        }

    def flow(
        self,
        *,
        year: int | None = None,
        object_id: int | None = None,
        person_id: int | None = None,
        party_id: int | None = None,
        household: bool = False,
        category_id: int | None = None,
        tag_id: int | None = None,
    ) -> dict:
        """Sankey: allocation source → category."""
        self._validate_share_filters(person_id=person_id, party_id=party_id, household=household)
        _, _, reference_month = self._resolve_year(year)
        items = self._load_items_for_charts(
            object_id=object_id, category_id=category_id, tag_id=tag_id
        )
        person_party = self._person_party_map()
        person_names = {p.id: p.name for p in self.db.query(Person).all()}
        party_names = {p.id: p.name for p in self.db.query(Party).all()}

        link_map: dict[tuple[str, str], Decimal] = defaultdict(lambda: Decimal("0.00"))

        for item, amount in self._iter_expense_snapshots(
            items,
            reference_month=reference_month,
            person_id=person_id,
            party_id=party_id,
            household=household,
            person_party=person_party,
        ):
            cat = item.category.name if item.category else "Unbekannt"
            if item.allocations:
                for alloc in item.allocations:
                    share = (amount * Decimal(alloc.percentage) / Decimal("100")).quantize(
                        Decimal("0.01")
                    )
                    if share <= 0:
                        continue
                    if alloc.is_household:
                        source = "Haushalt"
                    elif alloc.person_id and alloc.person_id in person_names:
                        source = person_names[alloc.person_id]
                    elif alloc.party_id and alloc.party_id in party_names:
                        source = party_names[alloc.party_id]
                    else:
                        source = "Unbekannt"
                    link_map[(source, cat)] += share
            elif item.object and item.object.person_id and item.object.person_id in person_names:
                link_map[(person_names[item.object.person_id], cat)] += amount
            elif item.object and item.object.party_id and item.object.party_id in party_names:
                link_map[(party_names[item.object.party_id], cat)] += amount
            else:
                link_map[("Haushalt", cat)] += amount

        nodes_set: set[str] = set()
        links = []
        for (source, target), value in sorted(link_map.items(), key=lambda x: x[1], reverse=True):
            if value <= 0:
                continue
            nodes_set.add(source)
            nodes_set.add(target)
            links.append(
                {
                    "source": source,
                    "target": target,
                    "value": float(value.quantize(Decimal("0.01"))),
                }
            )
        nodes = [{"name": name} for name in sorted(nodes_set)]
        return {"nodes": nodes, "links": links}
