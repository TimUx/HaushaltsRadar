"""Full JSON export / replace-import for KostenPilot domain data."""

from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any

from sqlalchemy import delete, text
from sqlalchemy.orm import Session, joinedload

from app.models import (
    Category,
    Contract,
    CostAllocation,
    CostHistoryEvent,
    CostItem,
    DocumentLink,
    EntryType,
    ObjectEntity,
    Party,
    PaymentInterval,
    Person,
    PriceHistory,
    Tag,
    User,
    UserRole,
    cost_item_tags,
)

SCHEMA_VERSION = 1
APP_NAME = "kostenpilot"


def _jsonable(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if hasattr(value, "value"):
        return value.value
    return value


def _parse_date(value: str | None) -> date | None:
    if not value:
        return None
    return date.fromisoformat(value[:10])


def _parse_decimal(value: Any) -> Decimal:
    return Decimal(str(value))


def export_bundle(db: Session) -> dict[str, Any]:
    parties = db.query(Party).order_by(Party.id).all()
    persons = db.query(Person).order_by(Person.id).all()
    objects = db.query(ObjectEntity).order_by(ObjectEntity.id).all()
    categories = db.query(Category).order_by(Category.id).all()
    tags = db.query(Tag).order_by(Tag.id).all()
    cost_items = (
        db.query(CostItem)
        .options(joinedload(CostItem.tags), joinedload(CostItem.allocations))
        .order_by(CostItem.id)
        .all()
    )
    contracts = db.query(Contract).order_by(Contract.id).all()
    price_history = db.query(PriceHistory).order_by(PriceHistory.id).all()
    document_links = db.query(DocumentLink).order_by(DocumentLink.id).all()
    users = db.query(User).order_by(User.id).all()

    data = {
        "parties": [
            {
                "id": p.id,
                "name": p.name,
                "description": p.description,
                "is_active": p.is_active,
                "created_at": _jsonable(p.created_at),
                "updated_at": _jsonable(p.updated_at),
            }
            for p in parties
        ],
        "persons": [
            {
                "id": p.id,
                "name": p.name,
                "color": p.color,
                "notes": p.notes,
                "party_id": p.party_id,
                "is_active": p.is_active,
                "created_at": _jsonable(p.created_at),
                "updated_at": _jsonable(p.updated_at),
            }
            for p in persons
        ],
        "objects": [
            {
                "id": o.id,
                "name": o.name,
                "description": o.description,
                "party_id": o.party_id,
                "person_id": o.person_id,
                "is_active": o.is_active,
                "created_at": _jsonable(o.created_at),
                "updated_at": _jsonable(o.updated_at),
            }
            for o in objects
        ],
        "categories": [
            {
                "id": c.id,
                "name": c.name,
                "sort_order": c.sort_order,
                "created_at": _jsonable(c.created_at),
                "updated_at": _jsonable(c.updated_at),
            }
            for c in categories
        ],
        "tags": [
            {
                "id": t.id,
                "name": t.name,
                "color": t.color,
                "created_at": _jsonable(t.created_at),
                "updated_at": _jsonable(t.updated_at),
            }
            for t in tags
        ],
        "cost_items": [
            {
                "id": item.id,
                "name": item.name,
                "description": item.description,
                "category_id": item.category_id,
                "subcategory_id": None,
                "object_id": item.object_id,
                "contract_partner": item.contract_partner,
                "amount": _jsonable(item.amount),
                "currency": item.currency,
                "entry_type": _jsonable(item.entry_type),
                "payment_interval": _jsonable(item.payment_interval),
                "custom_interval_months": item.custom_interval_months,
                "start_date": _jsonable(item.start_date),
                "end_date": _jsonable(item.end_date),
                "due_day": item.due_day,
                "due_month": item.due_month,
                "notes": item.notes,
                "is_active": item.is_active,
                "tag_ids": sorted(t.id for t in item.tags),
                "allocations": [
                    {
                        "id": a.id,
                        "person_id": a.person_id,
                        "party_id": a.party_id,
                        "is_household": a.is_household,
                        "percentage": _jsonable(a.percentage),
                        "created_at": _jsonable(a.created_at),
                        "updated_at": _jsonable(a.updated_at),
                    }
                    for a in item.allocations
                ],
                "created_at": _jsonable(item.created_at),
                "updated_at": _jsonable(item.updated_at),
            }
            for item in cost_items
        ],
        "contracts": [
            {
                "id": c.id,
                "cost_item_id": c.cost_item_id,
                "provider": c.provider,
                "contract_number": c.contract_number,
                "start_date": _jsonable(c.start_date),
                "end_date": _jsonable(c.end_date),
                "notice_period_days": c.notice_period_days,
                "auto_renewal": c.auto_renewal,
                "notes": c.notes,
                "created_at": _jsonable(c.created_at),
                "updated_at": _jsonable(c.updated_at),
            }
            for c in contracts
        ],
        "price_history": [
            {
                "id": h.id,
                "cost_item_id": h.cost_item_id,
                "amount": _jsonable(h.amount),
                "monthly_amount": _jsonable(h.monthly_amount),
                "valid_from": _jsonable(h.valid_from),
                "event_type": _jsonable(h.event_type),
                "notes": h.notes,
                "created_at": _jsonable(h.created_at),
                "updated_at": _jsonable(h.updated_at),
            }
            for h in price_history
        ],
        "document_links": [
            {
                "id": d.id,
                "cost_item_id": d.cost_item_id,
                "title": d.title,
                "url": d.url,
                "paperless_document_id": d.paperless_document_id,
                "notes": d.notes,
                "created_at": _jsonable(d.created_at),
                "updated_at": _jsonable(d.updated_at),
            }
            for d in document_links
        ],
        "users": [
            {
                "id": u.id,
                "username": u.username,
                "password_hash": u.password_hash,
                "role": _jsonable(u.role),
                "is_active": u.is_active,
                "person_id": u.person_id,
                "created_at": _jsonable(u.created_at),
                "updated_at": _jsonable(u.updated_at),
            }
            for u in users
        ],
    }

    return {
        "schema_version": SCHEMA_VERSION,
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "app": APP_NAME,
        "data": data,
    }


def _clear_all(db: Session) -> None:
    """Delete all transferable rows in FK-safe order."""
    db.execute(delete(DocumentLink))
    db.execute(delete(PriceHistory))
    db.execute(delete(Contract))
    db.execute(delete(CostAllocation))
    db.execute(delete(cost_item_tags))
    db.execute(delete(CostItem))
    db.execute(delete(Tag))
    # Legacy table may be empty
    from app.models import Subcategory

    db.execute(delete(Subcategory))
    db.execute(delete(Category))
    db.execute(delete(ObjectEntity))
    db.execute(delete(Person))
    db.execute(delete(Party))
    db.execute(delete(User))
    db.flush()


def _sync_sequences(db: Session) -> None:
    """Reset Postgres identity sequences after explicit-ID inserts."""
    bind = db.get_bind()
    if bind.dialect.name != "postgresql":
        return
    tables = [
        "parties",
        "persons",
        "objects",
        "categories",
        "tags",
        "cost_items",
        "cost_allocations",
        "contracts",
        "price_history",
        "document_links",
        "users",
    ]
    for table in tables:
        db.execute(
            text(
                f"SELECT setval(pg_get_serial_sequence('{table}', 'id'), "
                f"COALESCE((SELECT MAX(id) FROM {table}), 1), "
                f"COALESCE((SELECT MAX(id) FROM {table}), 0) > 0)"
            )
        )


def import_bundle(db: Session, bundle: dict[str, Any]) -> dict[str, int]:
    if not isinstance(bundle, dict):
        raise ValueError("Ungültiges Backup-Format")
    if bundle.get("app") not in (None, APP_NAME):
        raise ValueError("Backup stammt nicht von KostenPilot")
    version = bundle.get("schema_version")
    if version is None:
        raise ValueError("schema_version fehlt")
    if int(version) > SCHEMA_VERSION:
        raise ValueError(f"Backup-Version {version} wird nicht unterstützt (max {SCHEMA_VERSION})")

    data = bundle.get("data")
    if not isinstance(data, dict):
        raise ValueError("Backup enthält keinen data-Block")

    _clear_all(db)

    for row in data.get("parties", []):
        db.add(
            Party(
                id=row["id"],
                name=row["name"],
                description=row.get("description"),
                is_active=bool(row.get("is_active", True)),
            )
        )
    db.flush()

    for row in data.get("persons", []):
        db.add(
            Person(
                id=row["id"],
                name=row["name"],
                color=row.get("color"),
                notes=row.get("notes"),
                party_id=row.get("party_id"),
                is_active=bool(row.get("is_active", True)),
            )
        )
    db.flush()

    for row in data.get("objects", []):
        db.add(
            ObjectEntity(
                id=row["id"],
                name=row["name"],
                description=row.get("description"),
                party_id=row.get("party_id"),
                person_id=row.get("person_id"),
                is_active=bool(row.get("is_active", True)),
            )
        )
    db.flush()

    for row in data.get("categories", []):
        db.add(
            Category(
                id=row["id"],
                name=row["name"],
                sort_order=int(row.get("sort_order", 0)),
            )
        )
    db.flush()

    for row in data.get("tags", []):
        db.add(
            Tag(
                id=row["id"],
                name=row["name"],
                color=row.get("color"),
            )
        )
    db.flush()

    tag_by_id = {t.id: t for t in db.query(Tag).all()}

    for row in data.get("cost_items", []):
        item = CostItem(
            id=row["id"],
            name=row["name"],
            description=row.get("description"),
            category_id=row["category_id"],
            subcategory_id=None,
            object_id=row.get("object_id"),
            contract_partner=row.get("contract_partner"),
            amount=_parse_decimal(row["amount"]),
            currency=row.get("currency") or "EUR",
            entry_type=EntryType(row.get("entry_type") or "expense"),
            payment_interval=PaymentInterval(row["payment_interval"]),
            custom_interval_months=row.get("custom_interval_months"),
            start_date=_parse_date(row.get("start_date")),
            end_date=_parse_date(row.get("end_date")),
            due_day=row.get("due_day"),
            due_month=row.get("due_month"),
            notes=row.get("notes"),
            is_active=bool(row.get("is_active", True)),
        )
        tag_ids = row.get("tag_ids") or []
        item.tags = [tag_by_id[tid] for tid in tag_ids if tid in tag_by_id]
        db.add(item)
        db.flush()
        for alloc in row.get("allocations") or []:
            kwargs: dict = {
                "cost_item_id": item.id,
                "person_id": alloc.get("person_id"),
                "party_id": alloc.get("party_id"),
                "is_household": bool(alloc.get("is_household", False)),
                "percentage": _parse_decimal(alloc["percentage"]),
            }
            if alloc.get("id") is not None:
                kwargs["id"] = alloc["id"]
            db.add(CostAllocation(**kwargs))
    db.flush()

    for row in data.get("contracts", []):
        db.add(
            Contract(
                id=row["id"],
                cost_item_id=row["cost_item_id"],
                provider=row["provider"],
                contract_number=row.get("contract_number"),
                start_date=_parse_date(row.get("start_date")),
                end_date=_parse_date(row.get("end_date")),
                notice_period_days=row.get("notice_period_days"),
                auto_renewal=bool(row.get("auto_renewal", True)),
                notes=row.get("notes"),
            )
        )
    db.flush()

    for row in data.get("price_history", []):
        db.add(
            PriceHistory(
                id=row["id"],
                cost_item_id=row["cost_item_id"],
                amount=_parse_decimal(row["amount"]),
                monthly_amount=_parse_decimal(row.get("monthly_amount") or row["amount"]),
                valid_from=_parse_date(row["valid_from"]),
                event_type=CostHistoryEvent(row.get("event_type") or "changed"),
                notes=row.get("notes"),
            )
        )
    db.flush()

    for row in data.get("document_links", []):
        db.add(
            DocumentLink(
                id=row["id"],
                cost_item_id=row["cost_item_id"],
                title=row["title"],
                url=row.get("url"),
                paperless_document_id=row.get("paperless_document_id"),
                notes=row.get("notes"),
            )
        )
    db.flush()

    users = data.get("users") or []
    if not users:
        raise ValueError("Backup enthält keine Benutzer")
    for row in users:
        db.add(
            User(
                id=row["id"],
                username=row["username"],
                password_hash=row["password_hash"],
                role=UserRole(row.get("role") or "user"),
                is_active=bool(row.get("is_active", True)),
                person_id=row.get("person_id"),
            )
        )
    db.flush()

    _sync_sequences(db)
    db.commit()

    return {
        "parties": len(data.get("parties") or []),
        "persons": len(data.get("persons") or []),
        "objects": len(data.get("objects") or []),
        "categories": len(data.get("categories") or []),
        "tags": len(data.get("tags") or []),
        "cost_items": len(data.get("cost_items") or []),
        "contracts": len(data.get("contracts") or []),
        "price_history": len(data.get("price_history") or []),
        "document_links": len(data.get("document_links") or []),
        "users": len(users),
    }
