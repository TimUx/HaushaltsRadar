from datetime import date
from decimal import Decimal

from sqlalchemy.orm import Session

from app.models import (
    Category,
    Contract,
    CostAllocation,
    CostHistoryEvent,
    CostItem,
    ObjectEntity,
    PaymentInterval,
    Person,
    PriceHistory,
    Tag,
)


def seed_sample_data(db: Session) -> None:
    if db.query(CostItem).count() > 0:
        return

    tim = Person(name="Tim", color="#2F5D8C")
    frau = Person(name="Frau", color="#5B8FB9")
    db.add_all([tim, frau])

    haus = ObjectEntity(name="Haus", description="Einfamilienhaus")
    auto = ObjectEntity(name="Auto BMW", description="Familienfahrzeug")
    db.add_all([haus, auto])
    db.flush()

    cat_haus = db.query(Category).filter(Category.name == "Haus").one()
    cat_vers = db.query(Category).filter(Category.name == "Versicherungen").one()
    cat_komm = db.query(Category).filter(Category.name == "Kommunikation").one()

    tag_strom = db.query(Tag).filter(Tag.name == "Strom").one()
    tag_haft = db.query(Tag).filter(Tag.name == "Haftpflicht").one()
    tag_inet = db.query(Tag).filter(Tag.name == "Internet").one()

    strom = CostItem(
        name="Stromvertrag",
        description="Haushaltsstrom",
        category_id=cat_haus.id,
        object_id=haus.id,
        contract_partner="Stadtwerke Musterstadt",
        amount=Decimal("145.00"),
        currency="EUR",
        payment_interval=PaymentInterval.monthly,
        start_date=date(2025, 1, 1),
        due_day=15,
        is_active=True,
        tags=[tag_strom],
    )
    haftpflicht = CostItem(
        name="Private Haftpflicht",
        category_id=cat_vers.id,
        contract_partner="Allianz",
        amount=Decimal("84.00"),
        currency="EUR",
        payment_interval=PaymentInterval.annual,
        due_day=1,
        due_month=3,
        is_active=True,
        tags=[tag_haft],
    )
    internet = CostItem(
        name="Internet Glasfaser",
        category_id=cat_komm.id,
        object_id=haus.id,
        contract_partner="Telekom",
        amount=Decimal("49.95"),
        currency="EUR",
        payment_interval=PaymentInterval.monthly,
        due_day=1,
        is_active=True,
        tags=[tag_inet],
    )
    db.add_all([strom, haftpflicht, internet])
    db.flush()

    db.add_all(
        [
            CostAllocation(cost_item_id=strom.id, is_household=True, percentage=Decimal("70.00")),
            CostAllocation(
                cost_item_id=strom.id, person_id=tim.id, is_household=False, percentage=Decimal("30.00")
            ),
            CostAllocation(
                cost_item_id=haftpflicht.id, person_id=tim.id, is_household=False, percentage=Decimal("50.00")
            ),
            CostAllocation(
                cost_item_id=haftpflicht.id, person_id=frau.id, is_household=False, percentage=Decimal("50.00")
            ),
            CostAllocation(cost_item_id=internet.id, is_household=True, percentage=Decimal("100.00")),
        ]
    )

    db.add(
        Contract(
            cost_item_id=strom.id,
            provider="Stadtwerke Musterstadt",
            start_date=date(2025, 1, 1),
            notice_period_days=90,
            auto_renewal=True,
        )
    )
    db.add_all(
        [
            PriceHistory(
                cost_item_id=strom.id,
                amount=Decimal("120.00"),
                monthly_amount=Decimal("120.00"),
                valid_from=date(2025, 1, 1),
                event_type=CostHistoryEvent.created,
                notes="Vertragsstart",
            ),
            PriceHistory(
                cost_item_id=strom.id,
                amount=Decimal("145.00"),
                monthly_amount=Decimal("145.00"),
                valid_from=date(2026, 1, 1),
                event_type=CostHistoryEvent.changed,
                notes="Preisanpassung",
            ),
            PriceHistory(
                cost_item_id=haftpflicht.id,
                amount=Decimal("84.00"),
                monthly_amount=Decimal("7.00"),
                valid_from=date(2025, 3, 1),
                event_type=CostHistoryEvent.created,
            ),
            PriceHistory(
                cost_item_id=internet.id,
                amount=Decimal("49.95"),
                monthly_amount=Decimal("49.95"),
                valid_from=date(2025, 6, 1),
                event_type=CostHistoryEvent.created,
            ),
        ]
    )
    db.commit()
