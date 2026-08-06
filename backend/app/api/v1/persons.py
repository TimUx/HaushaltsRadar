from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import Person, User
from app.repositories.base import BaseRepository
from app.schemas import PersonCreate, PersonRead, PersonUpdate

router = APIRouter(prefix="/persons", tags=["Personen"])


@router.get("", response_model=list[PersonRead])
def list_persons(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[Person]:
    return BaseRepository(db, Person).list(limit=500)


@router.post("", response_model=PersonRead, status_code=status.HTTP_201_CREATED)
def create_person(
    payload: PersonCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> Person:
    return BaseRepository(db, Person).add(Person(**payload.model_dump()))


@router.get("/{person_id}", response_model=PersonRead)
def get_person(
    person_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> Person:
    person = BaseRepository(db, Person).get(person_id)
    if not person:
        raise HTTPException(status_code=404, detail="Person nicht gefunden")
    return person


@router.patch("/{person_id}", response_model=PersonRead)
def update_person(
    person_id: int,
    payload: PersonUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> Person:
    repo = BaseRepository(db, Person)
    person = repo.get(person_id)
    if not person:
        raise HTTPException(status_code=404, detail="Person nicht gefunden")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(person, key, value)
    return repo.save(person)


@router.delete("/{person_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_person(
    person_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> None:
    repo = BaseRepository(db, Person)
    person = repo.get(person_id)
    if not person:
        raise HTTPException(status_code=404, detail="Person nicht gefunden")
    repo.delete(person)
