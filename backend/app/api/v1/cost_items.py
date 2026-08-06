from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import CostAllocation, CostItem, User
from app.schemas import CostItemCreate, CostItemRead, CostItemUpdate
from app.services.amounts import monthly_amount, yearly_amount
from app.services.bootstrap import validate_allocations

router = APIRouter(prefix="/cost-items", tags=["Kosten"])


def _to_read(item: CostItem) -> CostItemRead:
    return CostItemRead(
        id=item.id,
        name=item.name,
        description=item.description,
        category_id=item.category_id,
        subcategory_id=item.subcategory_id,
        object_id=item.object_id,
        contract_partner=item.contract_partner,
        amount=item.amount,
        currency=item.currency,
        payment_interval=item.payment_interval,
        custom_interval_months=item.custom_interval_months,
        start_date=item.start_date,
        end_date=item.end_date,
        due_day=item.due_day,
        due_month=item.due_month,
        notes=item.notes,
        is_active=item.is_active,
        allocations=list(item.allocations),
        monthly_amount=monthly_amount(item),
        yearly_amount=yearly_amount(item),
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


def _load_item(db: Session, item_id: int) -> CostItem | None:
    return (
        db.query(CostItem)
        .options(joinedload(CostItem.allocations))
        .filter(CostItem.id == item_id)
        .first()
    )


@router.get("", response_model=list[CostItemRead])
def list_cost_items(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[CostItemRead]:
    items = db.query(CostItem).options(joinedload(CostItem.allocations)).order_by(CostItem.name).all()
    return [_to_read(item) for item in items]


@router.post("", response_model=CostItemRead, status_code=status.HTTP_201_CREATED)
def create_cost_item(
    payload: CostItemCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> CostItemRead:
    data = payload.model_dump()
    allocations = data.pop("allocations", [])
    try:
        validate_allocations(allocations)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    item = CostItem(**data)
    db.add(item)
    db.flush()
    for alloc in allocations:
        db.add(CostAllocation(cost_item_id=item.id, **alloc))
    db.commit()
    loaded = _load_item(db, item.id)
    assert loaded is not None
    return _to_read(loaded)


@router.get("/{item_id}", response_model=CostItemRead)
def get_cost_item(
    item_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
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
    _: User = Depends(get_current_user),
) -> CostItemRead:
    item = _load_item(db, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Kostenposition nicht gefunden")

    data = payload.model_dump(exclude_unset=True)
    allocations = data.pop("allocations", None)
    for key, value in data.items():
        setattr(item, key, value)

    if allocations is not None:
        try:
            validate_allocations(allocations)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        item.allocations.clear()
        db.flush()
        for alloc in allocations:
            db.add(CostAllocation(cost_item_id=item.id, **alloc))

    db.commit()
    loaded = _load_item(db, item_id)
    assert loaded is not None
    return _to_read(loaded)


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_cost_item(
    item_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> None:
    item = db.get(CostItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Kostenposition nicht gefunden")
    db.delete(item)
    db.commit()
