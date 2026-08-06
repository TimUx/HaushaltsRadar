from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import Category, Subcategory, User
from app.schemas import CategoryCreate, CategoryRead, CategoryUpdate, SubcategoryCreate, SubcategoryRead

router = APIRouter(prefix="/categories", tags=["Kategorien"])


@router.get("", response_model=list[CategoryRead])
def list_categories(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[Category]:
    return (
        db.query(Category)
        .options(joinedload(Category.subcategories))
        .order_by(Category.sort_order, Category.name)
        .all()
    )


@router.post("", response_model=CategoryRead, status_code=status.HTTP_201_CREATED)
def create_category(
    payload: CategoryCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> Category:
    category = Category(name=payload.name, sort_order=payload.sort_order)
    db.add(category)
    db.flush()
    for sub in payload.subcategories:
        db.add(
            Subcategory(
                category_id=category.id,
                name=sub.name,
                sort_order=sub.sort_order,
            )
        )
    db.commit()
    db.refresh(category)
    return (
        db.query(Category)
        .options(joinedload(Category.subcategories))
        .filter(Category.id == category.id)
        .one()
    )


@router.patch("/{category_id}", response_model=CategoryRead)
def update_category(
    category_id: int,
    payload: CategoryUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> Category:
    category = db.get(Category, category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Kategorie nicht gefunden")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(category, key, value)
    db.commit()
    return (
        db.query(Category)
        .options(joinedload(Category.subcategories))
        .filter(Category.id == category_id)
        .one()
    )


@router.post(
    "/{category_id}/subcategories",
    response_model=SubcategoryRead,
    status_code=status.HTTP_201_CREATED,
)
def create_subcategory(
    category_id: int,
    payload: SubcategoryCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> Subcategory:
    category = db.get(Category, category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Kategorie nicht gefunden")
    sub = Subcategory(category_id=category_id, **payload.model_dump())
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return sub


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(
    category_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> None:
    category = db.get(Category, category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Kategorie nicht gefunden")
    db.delete(category)
    db.commit()
