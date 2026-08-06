from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import ObjectEntity, User
from app.repositories.base import BaseRepository
from app.schemas import ObjectCreate, ObjectRead, ObjectUpdate

router = APIRouter(prefix="/objects", tags=["Objekte"])


def _validate_object_assignment(party_id: int | None, person_id: int | None) -> None:
    if party_id is not None and person_id is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Objekt kann nur einer Partei oder einer Person zugeordnet werden, nicht beiden.",
        )


@router.get("", response_model=list[ObjectRead])
def list_objects(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[ObjectEntity]:
    return BaseRepository(db, ObjectEntity).list(limit=500)


@router.post("", response_model=ObjectRead, status_code=status.HTTP_201_CREATED)
def create_object(
    payload: ObjectCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> ObjectEntity:
    _validate_object_assignment(payload.party_id, payload.person_id)
    return BaseRepository(db, ObjectEntity).add(ObjectEntity(**payload.model_dump()))


@router.get("/{object_id}", response_model=ObjectRead)
def get_object(
    object_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> ObjectEntity:
    entity = BaseRepository(db, ObjectEntity).get(object_id)
    if not entity:
        raise HTTPException(status_code=404, detail="Objekt nicht gefunden")
    return entity


@router.patch("/{object_id}", response_model=ObjectRead)
def update_object(
    object_id: int,
    payload: ObjectUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> ObjectEntity:
    repo = BaseRepository(db, ObjectEntity)
    entity = repo.get(object_id)
    if not entity:
        raise HTTPException(status_code=404, detail="Objekt nicht gefunden")
    updates = payload.model_dump(exclude_unset=True)
    party_id = updates.get("party_id", entity.party_id)
    person_id = updates.get("person_id", entity.person_id)
    _validate_object_assignment(party_id, person_id)
    for key, value in updates.items():
        setattr(entity, key, value)
    return repo.save(entity)


@router.delete("/{object_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_object(
    object_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> None:
    repo = BaseRepository(db, ObjectEntity)
    entity = repo.get(object_id)
    if not entity:
        raise HTTPException(status_code=404, detail="Objekt nicht gefunden")
    repo.delete(entity)
