from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import require_admin
from app.core.security import hash_password
from app.db.session import get_db
from app.models import Person, User, UserRole
from app.schemas import UserCreate, UserRead, UserUpdate

router = APIRouter(prefix="/users", tags=["Benutzer"])

VALID_ROLES = {UserRole.admin.value, UserRole.user.value, UserRole.viewer.value}


def _parse_role(value: str) -> UserRole:
    if value not in VALID_ROLES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ungültige Rolle. Erlaubt: admin, user, viewer",
        )
    return UserRole(value)


def _admin_count(db: Session) -> int:
    return db.query(User).filter(User.role == UserRole.admin, User.is_active.is_(True)).count()


def _resolve_person_id(db: Session, person_id: int | None) -> int | None:
    if person_id is None:
        return None
    person = db.get(Person, person_id)
    if not person or not person.is_active:
        raise HTTPException(status_code=400, detail="Person nicht gefunden oder inaktiv")
    return person.id


@router.get("", response_model=list[UserRead])
def list_users(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> list[User]:
    return db.query(User).order_by(User.username).all()


@router.post("", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> User:
    user = User(
        username=payload.username.strip(),
        password_hash=hash_password(payload.password),
        role=_parse_role(payload.role),
        is_active=payload.is_active,
        person_id=_resolve_person_id(db, payload.person_id),
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail="Benutzername existiert bereits") from exc
    db.refresh(user)
    return user


@router.patch("/{user_id}", response_model=UserRead)
def update_user(
    user_id: int,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin),
) -> User:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Benutzer nicht gefunden")

    data = payload.model_dump(exclude_unset=True)
    new_role = _parse_role(data["role"]) if "role" in data else user.role
    new_active = data.get("is_active", user.is_active)

    becoming_non_admin = user.role == UserRole.admin and (
        new_role != UserRole.admin or new_active is False
    )
    if becoming_non_admin and _admin_count(db) <= 1:
        raise HTTPException(
            status_code=400,
            detail="Der letzte aktive Administrator kann nicht entfernt oder deaktiviert werden",
        )

    if "username" in data and data["username"] is not None:
        user.username = data["username"].strip()
    if "password" in data and data["password"]:
        user.password_hash = hash_password(data["password"])
    if "role" in data:
        user.role = new_role
    if "is_active" in data:
        user.is_active = bool(data["is_active"])
    if "person_id" in data:
        user.person_id = _resolve_person_id(db, data["person_id"])

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail="Benutzername existiert bereits") from exc
    db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin),
) -> None:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Benutzer nicht gefunden")
    if user.id == current_admin.id:
        raise HTTPException(status_code=400, detail="Eigenes Konto kann nicht gelöscht werden")
    if user.role == UserRole.admin and _admin_count(db) <= 1:
        raise HTTPException(
            status_code=400,
            detail="Der letzte Administrator kann nicht gelöscht werden",
        )
    db.delete(user)
    db.commit()
