from collections import defaultdict
from decimal import Decimal

from sqlalchemy.orm import Session, joinedload

from app.models import (
    Category,
    Contract,
    CostAllocation,
    CostItem,
    ObjectEntity,
    Party,
    PaymentInterval,
    Person,
    Tag,
)
from app.schemas import DashboardSummary, NamedAmount, UpcomingDue
from app.services.amounts import monthly_amount, yearly_amount
from app.services.due_dates import format_due_label, next_due_sort_key

INTERVAL_LABELS_DE = {
    PaymentInterval.monthly: "Monatlich",
    PaymentInterval.bimonthly: "Zweimonatlich",
    PaymentInterval.quarterly: "Vierteljährlich",
    PaymentInterval.semiannual: "Halbjährlich",
    PaymentInterval.annual: "Jährlich",
    PaymentInterval.custom: "Individuell",
}


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
                    "contract_partner": item.contract_partner,
                    "amount": item.amount,
                    "currency": item.currency,
                    "payment_interval": item.payment_interval.value,
                    "payment_interval_label": INTERVAL_LABELS_DE.get(
                        item.payment_interval, item.payment_interval.value
                    ),
                    "monthly_amount": monthly_amount(item),
                    "yearly_amount": yearly_amount(item),
                    "due_label": format_due_label(item.due_day, item.due_month),
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

        query = (
            self.db.query(CostItem)
            .options(
                joinedload(CostItem.allocations).joinedload(CostAllocation.person),
                joinedload(CostItem.allocations).joinedload(CostAllocation.party),
                joinedload(CostItem.category),
                joinedload(CostItem.tags),
                joinedload(CostItem.object),
            )
            .filter(CostItem.is_active.is_(True))
        )
        if object_id is not None:
            query = query.filter(CostItem.object_id == object_id)
        if category_id is not None:
            query = query.filter(CostItem.category_id == category_id)
        if tag_id is not None:
            query = query.filter(CostItem.tags.any(Tag.id == tag_id))

        items = query.all()
        persons = self.db.query(Person).all()
        person_names = {p.id: p.name for p in persons}
        person_party = {p.id: p.party_id for p in persons}
        party_names = {p.id: p.name for p in self.db.query(Party).all()}

        monthly_total = Decimal("0.00")
        yearly_total = Decimal("0.00")
        by_person: dict[str, Decimal] = defaultdict(lambda: Decimal("0.00"))
        by_party: dict[str, Decimal] = defaultdict(lambda: Decimal("0.00"))
        by_object: dict[tuple[int | None, str], Decimal] = defaultdict(lambda: Decimal("0.00"))
        by_category: dict[tuple[int, str], Decimal] = defaultdict(lambda: Decimal("0.00"))
        top_items: list[tuple[int, str, Decimal]] = []
        included_ids: list[int] = []

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

            m = (monthly_amount(item) * factor).quantize(Decimal("0.01"))
            y = (yearly_amount(item) * factor).quantize(Decimal("0.01"))
            if m == 0 and y == 0:
                continue

            included_ids.append(item.id)
            monthly_total += m
            yearly_total += y
            top_items.append((item.id, item.name, m))

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
            else:
                # Unfiltered: breakdown by explicit allocations, then roll persons into parties
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

        included_set = set(included_ids)
        if included_set:
            active_contracts = (
                self.db.query(Contract).filter(Contract.cost_item_id.in_(included_set)).count()
            )
        else:
            active_contracts = 0

        due_items = [item for item in items if item.id in included_set and item.due_day is not None]
        due_items.sort(key=next_due_sort_key)
        upcoming = []
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
                )
            )

        top_items.sort(key=lambda t: t[2], reverse=True)

        return DashboardSummary(
            monthly_fixed_costs=monthly_total.quantize(Decimal("0.01")),
            yearly_fixed_costs=yearly_total.quantize(Decimal("0.01")),
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
                for iid, name, amount in top_items[:10]
            ],
            upcoming_dues=upcoming,
        )
