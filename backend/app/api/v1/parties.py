from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import Party, User
from app.repositories.base import BaseRepository
from app.schemas import PartyCreate, PartyRead, PartyUpdate

router = APIRouter(prefix="/parties", tags=["Parteien"])


@router.get("", response_model=list[PartyRead])
def list_parties(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[Party]:
    return BaseRepository(db, Party).list(limit=500)


@router.post("", response_model=PartyRead, status_code=status.HTTP_201_CREATED)
def create_party(
    payload: PartyCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> Party:
    return BaseRepository(db, Party).add(Party(**payload.model_dump()))


@router.get("/{party_id}", response_model=PartyRead)
def get_party(
    party_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> Party:
    party = BaseRepository(db, Party).get(party_id)
    if not party:
        raise HTTPException(status_code=404, detail="Partei nicht gefunden")
    return party


@router.patch("/{party_id}", response_model=PartyRead)
def update_party(
    party_id: int,
    payload: PartyUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> Party:
    repo = BaseRepository(db, Party)
    party = repo.get(party_id)
    if not party:
        raise HTTPException(status_code=404, detail="Partei nicht gefunden")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(party, key, value)
    return repo.save(party)


@router.delete("/{party_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_party(
    party_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> None:
    repo = BaseRepository(db, Party)
    party = repo.get(party_id)
    if not party:
        raise HTTPException(status_code=404, detail="Partei nicht gefunden")
    repo.delete(party)
