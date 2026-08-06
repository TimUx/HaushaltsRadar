from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.api.deps import require_editor
from app.db.session import get_db
from app.models import (
    CostAllocation,
    CostHistoryEvent,
    CostItem,
    PaymentInterval,
    PriceHistory,
    Tag,
    User,
)
from app.schemas import (
    CostItemCreate,
    CostItemRead,
    CostItemUpdate,
    PriceHistoryEntryCreate,
    PriceHistoryRead,
    TagRead,
)
from app.services.amounts import monthly_amount, monthly_from_amount, yearly_amount
from app.services.bootstrap import validate_allocations
from app.services.cost_history import record_price_history

router = APIRouter(prefix="/cost-items", tags=["Kosten"])


def _resolve_tags(db: Session, tag_ids: list[int]) -> list[Tag]:
    if not tag_ids:
        return []
    tags = db.query(Tag).filter(Tag.id.in_(tag_ids)).all()
    if len(tags) != len(set(tag_ids)):
        raise HTTPException(status_code=400, detail="Mindestens ein Tag wurde nicht gefunden")
    return tags


def _validate_item_fields(
    *,
    payment_interval: PaymentInterval,
    start_date: date | None,
    custom_interval_months: int | None,
) -> None:
    if payment_interval == PaymentInterval.one_time and start_date is None:
        raise HTTPException(
            status_code=400,
            detail="Für einmalige Posten ist ein Datum (start_date) erforderlich",
        )
    if payment_interval == PaymentInterval.custom and not custom_interval_months:
        raise HTTPException(
            status_code=400,
            detail="Individuelles Intervall benötigt custom_interval_months",
        )


def _to_read(item: CostItem) -> CostItemRead:
    return CostItemRead(
        id=item.id,
        name=item.name,
        description=item.description,
        category_id=item.category_id,
        object_id=item.object_id,
        contract_partner=item.contract_partner,
        amount=item.amount,
        currency=item.currency,
        entry_type=item.entry_type,
        payment_interval=item.payment_interval,
        custom_interval_months=item.custom_interval_months,
        start_date=item.start_date,
        end_date=item.end_date,
        due_day=item.due_day,
        due_month=item.due_month,
        notes=item.notes,
        is_active=item.is_active,
        tags=[TagRead.model_validate(tag) for tag in item.tags],
        allocations=list(item.allocations),
        monthly_amount=monthly_amount(item),
        yearly_amount=yearly_amount(item),
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


def _load_item(db: Session, item_id: int) -> CostItem | None:
    return (
        db.query(CostItem)
        .options(joinedload(CostItem.allocations), joinedload(CostItem.tags))
        .filter(CostItem.id == item_id)
        .first()
    )


def _parse_event_type(value: str) -> CostHistoryEvent:
    try:
        return CostHistoryEvent(value)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Ungültiger event_type") from exc


@router.get("", response_model=list[CostItemRead])
def list_cost_items(
    db: Session = Depends(get_db),
    _: User = Depends(require_editor),
) -> list[CostItemRead]:
    items = (
        db.query(CostItem)
        .options(joinedload(CostItem.allocations), joinedload(CostItem.tags))
        .order_by(CostItem.name)
        .all()
    )
    return [_to_read(item) for item in items]


@router.post("", response_model=CostItemRead, status_code=status.HTTP_201_CREATED)
def create_cost_item(
    payload: CostItemCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_editor),
) -> CostItemRead:
    data = payload.model_dump()
    allocations = data.pop("allocations", [])
    tag_ids = data.pop("tag_ids", [])
    _validate_item_fields(
        payment_interval=data["payment_interval"],
        start_date=data.get("start_date"),
        custom_interval_months=data.get("custom_interval_months"),
    )
    if data["payment_interval"] == PaymentInterval.one_time:
        data["custom_interval_months"] = None
        data["due_month"] = None
    try:
        validate_allocations(allocations)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    item = CostItem(**data)
    item.tags = _resolve_tags(db, tag_ids)
    db.add(item)
    db.flush()
    for alloc in allocations:
        db.add(CostAllocation(cost_item_id=item.id, **alloc))
    record_price_history(
        db,
        item,
        event_type=CostHistoryEvent.created,
        valid_from=item.start_date or date.today(),
        notes=f"Kostenposition angelegt ({item.amount} €)",
    )
    db.commit()
    loaded = _load_item(db, item.id)
    assert loaded is not None
    return _to_read(loaded)


@router.get("/{item_id}", response_model=CostItemRead)
def get_cost_item(
    item_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_editor),
) -> CostItemRead:
    item = _load_item(db, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Kostenposition nicht gefunden")
    return _to_read(item)


@router.patch("/{item_id}", response_model=CostItemRead)
def update_cost_item(
    item_id: int,
    payload: CostItemUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_editor),
) -> CostItemRead:
    item = _load_item(db, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Kostenposition nicht gefunden")

    before_amount = Decimal(item.amount)
    before_interval = item.payment_interval
    before_custom = item.custom_interval_months
    before_entry = item.entry_type
    before_start = item.start_date
    before_active = item.is_active
    before_monthly = monthly_amount(item)

    data = payload.model_dump(exclude_unset=True)
    allocations = data.pop("allocations", None)
    tag_ids = data.pop("tag_ids", None)
    price_valid_from = data.pop("price_valid_from", None)
    price_change_notes = data.pop("price_change_notes", None)
    for key, value in data.items():
        setattr(item, key, value)

    _validate_item_fields(
        payment_interval=item.payment_interval,
        start_date=item.start_date,
        custom_interval_months=item.custom_interval_months,
    )
    if item.payment_interval == PaymentInterval.one_time:
        item.custom_interval_months = None
        item.due_month = None

    if tag_ids is not None:
        item.tags = _resolve_tags(db, tag_ids)

    if allocations is not None:
        try:
            validate_allocations(allocations)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        item.allocations.clear()
        db.flush()
        for alloc in allocations:
            db.add(CostAllocation(cost_item_id=item.id, **alloc))

    after_monthly = monthly_amount(item)
    amount_changed = (
        Decimal(item.amount) != before_amount
        or item.payment_interval != before_interval
        or item.custom_interval_months != before_custom
        or item.entry_type != before_entry
        or item.start_date != before_start
        or after_monthly != before_monthly
    )
    if before_active and not item.is_active:
        record_price_history(
            db,
            item,
            event_type=CostHistoryEvent.ended,
            valid_from=price_valid_from,
            notes=price_change_notes or "Kostenposition deaktiviert",
            force_zero=True,
        )
    elif not before_active and item.is_active:
        record_price_history(
            db,
            item,
            event_type=CostHistoryEvent.reactivated,
            valid_from=price_valid_from,
            notes=price_change_notes or "Kostenposition reaktiviert",
        )
    elif amount_changed:
        note = price_change_notes or (
            f"Betrag {before_amount} € → {item.amount} €"
            if Decimal(item.amount) != before_amount
            else "Betrag oder Intervall angepasst"
        )
        record_price_history(
            db,
            item,
            event_type=CostHistoryEvent.changed,
            valid_from=price_valid_from,
            notes=note,
        )

    db.commit()
    loaded = _load_item(db, item_id)
    assert loaded is not None
    return _to_read(loaded)


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_cost_item(
    item_id: int,
    permanent: bool = False,
    db: Session = Depends(get_db),
    _: User = Depends(require_editor),
) -> None:
    """Deactivate (default) or permanently delete a cost item.

    Soft-delete keeps history for cancelled contracts.
    permanent=true removes the item and all related history/allocations.
    """
    item = _load_item(db, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Kostenposition nicht gefunden")

    if permanent:
        db.delete(item)
        db.commit()
        return

    if item.is_active:
        item.is_active = False
        record_price_history(
            db,
            item,
            event_type=CostHistoryEvent.ended,
            notes="Kostenposition deaktiviert",
            force_zero=True,
        )
    db.commit()


@router.get("/{item_id}/price-history", response_model=list[PriceHistoryRead])
def list_item_price_history(
    item_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_editor),
) -> list[PriceHistory]:
    if not db.get(CostItem, item_id):
        raise HTTPException(status_code=404, detail="Kostenposition nicht gefunden")
    return (
        db.query(PriceHistory)
        .filter(PriceHistory.cost_item_id == item_id)
        .order_by(PriceHistory.valid_from.desc(), PriceHistory.id.desc())
        .all()
    )


@router.post(
    "/{item_id}/price-history",
    response_model=PriceHistoryRead,
    status_code=status.HTTP_201_CREATED,
)
def create_item_price_history(
    item_id: int,
    payload: PriceHistoryEntryCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_editor),
) -> PriceHistory:
    """Add a dated price point so past years keep the correct contribution."""
    item = db.get(CostItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Kostenposition nicht gefunden")

    monthly = monthly_from_amount(
        payload.amount,
        item.payment_interval,
        item.custom_interval_months,
    )
    entry = PriceHistory(
        cost_item_id=item.id,
        amount=payload.amount,
        monthly_amount=monthly,
        valid_from=payload.valid_from,
        event_type=_parse_event_type(payload.event_type),
        notes=payload.notes or f"Preisstand ab {payload.valid_from.isoformat()}",
    )
    db.add(entry)
    db.flush()

    if payload.sync_current_amount:
        latest = (
            db.query(PriceHistory)
            .filter(PriceHistory.cost_item_id == item.id)
            .order_by(PriceHistory.valid_from.desc(), PriceHistory.id.desc())
            .first()
        )
        if latest and latest.id == entry.id and entry.event_type != CostHistoryEvent.ended:
            item.amount = payload.amount

    db.commit()
    db.refresh(entry)
    return entry


@router.delete(
    "/{item_id}/price-history/{entry_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_item_price_history(
    item_id: int,
    entry_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_editor),
) -> None:
    entry = (
        db.query(PriceHistory)
        .filter(PriceHistory.id == entry_id, PriceHistory.cost_item_id == item_id)
        .first()
    )
    if not entry:
        raise HTTPException(status_code=404, detail="Preisverlaufseintrag nicht gefunden")
    db.delete(entry)
    db.commit()
