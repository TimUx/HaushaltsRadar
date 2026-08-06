from datetime import date
from decimal import Decimal

from sqlalchemy.orm import Session

from app.models import (
    Category,
    Contract,
    CostAllocation,
    CostHistoryEvent,
    CostItem,
    EntryType,
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
    tag_wasser = db.query(Tag).filter(Tag.name == "Wasser").one()
    tag_pv = db.query(Tag).filter(Tag.name == "PV").one()

    strom = CostItem(
        name="Stromvertrag",
        description="Haushaltsstrom",
        category_id=cat_haus.id,
        object_id=haus.id,
        contract_partner="Stadtwerke Musterstadt",
        amount=Decimal("145.00"),
        currency="EUR",
        entry_type=EntryType.expense,
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
        entry_type=EntryType.expense,
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
        entry_type=EntryType.expense,
        payment_interval=PaymentInterval.monthly,
        due_day=1,
        is_active=True,
        tags=[tag_inet],
    )
    nachzahlung = CostItem(
        name="Strom Nachzahlung",
        description="Jahresabrechnung Nachzahlung",
        category_id=cat_haus.id,
        object_id=haus.id,
        contract_partner="Stadtwerke Musterstadt",
        amount=Decimal("218.40"),
        currency="EUR",
        entry_type=EntryType.expense,
        payment_interval=PaymentInterval.one_time,
        start_date=date(2026, 3, 15),
        is_active=True,
        tags=[tag_strom],
    )
    erstattung = CostItem(
        name="Wasser Erstattung",
        description="Gutschrift Jahresabrechnung",
        category_id=cat_haus.id,
        object_id=haus.id,
        amount=Decimal("42.50"),
        currency="EUR",
        entry_type=EntryType.income,
        payment_interval=PaymentInterval.one_time,
        start_date=date(2026, 4, 10),
        is_active=True,
        tags=[tag_wasser],
    )
    pv = CostItem(
        name="PV Einspeisung",
        description="Vergütung Überschusseinspeisung",
        category_id=cat_haus.id,
        object_id=haus.id,
        contract_partner="Netzbetreiber",
        amount=Decimal("65.00"),
        currency="EUR",
        entry_type=EntryType.income,
        payment_interval=PaymentInterval.monthly,
        start_date=date(2025, 6, 1),
        due_day=20,
        is_active=True,
        tags=[tag_pv],
    )
    db.add_all([strom, haftpflicht, internet, nachzahlung, erstattung, pv])
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
            CostAllocation(cost_item_id=nachzahlung.id, is_household=True, percentage=Decimal("100.00")),
            CostAllocation(cost_item_id=erstattung.id, is_household=True, percentage=Decimal("100.00")),
            CostAllocation(cost_item_id=pv.id, is_household=True, percentage=Decimal("100.00")),
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
            PriceHistory(
                cost_item_id=nachzahlung.id,
                amount=Decimal("218.40"),
                monthly_amount=Decimal("0.00"),
                valid_from=date(2026, 3, 15),
                event_type=CostHistoryEvent.created,
                notes="Einmalige Nachzahlung",
            ),
            PriceHistory(
                cost_item_id=erstattung.id,
                amount=Decimal("42.50"),
                monthly_amount=Decimal("0.00"),
                valid_from=date(2026, 4, 10),
                event_type=CostHistoryEvent.created,
                notes="Einmalige Erstattung",
            ),
            PriceHistory(
                cost_item_id=pv.id,
                amount=Decimal("65.00"),
                monthly_amount=Decimal("65.00"),
                valid_from=date(2025, 6, 1),
                event_type=CostHistoryEvent.created,
                notes="PV Einspeisevergütung",
            ),
        ]
    )
    db.commit()
