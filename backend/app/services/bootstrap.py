from decimal import Decimal

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import hash_password
from app.models import Category, Tag, User, UserRole

DEFAULT_CATEGORIES: list[str] = [
    "Haus",
    "Versicherungen",
    "Mobilität",
    "Freizeit",
    "Gesundheit",
    "Kommunikation",
]

DEFAULT_TAGS: list[str] = [
    "Strom",
    "Wasser",
    "Abwasser",
    "Müll",
    "Grundsteuer",
    "Gemeindeabgaben",
    "Gebäudeversicherung",
    "Wartung",
    "Haftpflicht",
    "Zahnzusatz",
    "KFZ",
    "Rechtsschutz",
    "Auto",
    "Motorrad",
    "Tankkosten",
    "Vereine",
    "Streaming",
    "Hobby",
    "Zusatzversicherungen",
    "Medikamente",
    "Internet",
    "Mobilfunk",
    "PV",
]


def seed_categories(db: Session) -> None:
    if db.query(Category).count() == 0:
        for sort_order, name in enumerate(DEFAULT_CATEGORIES):
            db.add(Category(name=name, sort_order=sort_order))
        db.commit()

    existing_tags = {t.name for t in db.query(Tag).all()}
    missing = [name for name in DEFAULT_TAGS if name not in existing_tags]
    if missing:
        for name in missing:
            db.add(Tag(name=name))
        db.commit()


def ensure_bootstrap_admin(db: Session) -> None:
    settings = get_settings()
    existing = db.query(User).filter(User.username == settings.bootstrap_admin_username).first()
    if existing:
        return
    user = User(
        username=settings.bootstrap_admin_username,
        password_hash=hash_password(settings.bootstrap_admin_password),
        role=UserRole.admin,
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
