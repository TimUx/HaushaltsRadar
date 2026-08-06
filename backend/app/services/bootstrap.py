from decimal import Decimal

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import hash_password
from app.models import Category, Subcategory, User

DEFAULT_CATEGORIES: list[tuple[str, list[str]]] = [
    (
        "Haus",
        [
            "Strom",
            "Wasser",
            "Abwasser",
            "Müll",
            "Grundsteuer",
            "Gemeindeabgaben",
            "Gebäudeversicherung",
            "Wartung",
        ],
    ),
    ("Versicherungen", ["Haftpflicht", "Zahnzusatz", "KFZ", "Rechtsschutz", "Sonstige"]),
    ("Mobilität", ["Auto", "Motorrad", "Tankkosten", "Versicherung"]),
    ("Freizeit", ["Vereine", "Streaming", "Hobby"]),
    ("Gesundheit", ["Zusatzversicherungen", "Medikamente"]),
    ("Kommunikation", ["Internet", "Mobilfunk"]),
]


def seed_categories(db: Session) -> None:
    if db.query(Category).count() > 0:
        return
    for sort_order, (name, subs) in enumerate(DEFAULT_CATEGORIES):
        category = Category(name=name, sort_order=sort_order)
        db.add(category)
        db.flush()
        for sub_order, sub_name in enumerate(subs):
            db.add(Subcategory(category_id=category.id, name=sub_name, sort_order=sub_order))
    db.commit()


def ensure_bootstrap_admin(db: Session) -> None:
    settings = get_settings()
    existing = db.query(User).filter(User.username == settings.bootstrap_admin_username).first()
    if existing:
        return
    user = User(
        username=settings.bootstrap_admin_username,
        password_hash=hash_password(settings.bootstrap_admin_password),
        is_admin=True,
        is_active=True,
    )
    db.add(user)
    db.commit()


def validate_allocations(allocations: list[dict]) -> None:
    if not allocations:
        return
    total = sum((Decimal(str(a["percentage"])) for a in allocations), Decimal("0"))
    if total != Decimal("100"):
        raise ValueError("Die Summe der Kostenverteilung muss genau 100 % betragen.")
    for allocation in allocations:
        is_household = bool(allocation.get("is_household", False))
        person_id = allocation.get("person_id")
        party_id = allocation.get("party_id")
        targets = sum(
            [
                1 if is_household else 0,
                1 if person_id is not None else 0,
                1 if party_id is not None else 0,
            ]
        )
        if targets != 1:
            raise ValueError(
                "Jeder Anteil muss genau einem Ziel zugeordnet sein: Haushalt, Person oder Partei."
            )
