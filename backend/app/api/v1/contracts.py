from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import Contract, CostItem, DocumentLink, PriceHistory, User
from app.schemas import (
    ContractCreate,
    ContractRead,
    ContractUpdate,
    DocumentLinkCreate,
    DocumentLinkRead,
    DocumentLinkUpdate,
    PriceHistoryCreate,
    PriceHistoryRead,
)

router = APIRouter(tags=["Verträge"])


@router.get("/contracts", response_model=list[ContractRead])
def list_contracts(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[Contract]:
    return db.query(Contract).order_by(Contract.provider).all()


@router.post("/contracts", response_model=ContractRead, status_code=status.HTTP_201_CREATED)
def create_contract(
    payload: ContractCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> Contract:
    if not db.get(CostItem, payload.cost_item_id):
        raise HTTPException(status_code=400, detail="Kostenposition nicht gefunden")
    existing = db.query(Contract).filter(Contract.cost_item_id == payload.cost_item_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Für diese Kostenposition existiert bereits ein Vertrag")
    contract = Contract(**payload.model_dump())
    db.add(contract)
    db.commit()
    db.refresh(contract)
    return contract


@router.get("/contracts/{contract_id}", response_model=ContractRead)
def get_contract(
    contract_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> Contract:
    contract = db.get(Contract, contract_id)
    if not contract:
        raise HTTPException(status_code=404, detail="Vertrag nicht gefunden")
    return contract


@router.patch("/contracts/{contract_id}", response_model=ContractRead)
def update_contract(
    contract_id: int,
    payload: ContractUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> Contract:
    contract = db.get(Contract, contract_id)
    if not contract:
        raise HTTPException(status_code=404, detail="Vertrag nicht gefunden")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(contract, key, value)
    db.commit()
    db.refresh(contract)
    return contract


@router.delete("/contracts/{contract_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_contract(
    contract_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> None:
    contract = db.get(Contract, contract_id)
    if not contract:
        raise HTTPException(status_code=404, detail="Vertrag nicht gefunden")
    db.delete(contract)
    db.commit()


@router.get("/price-history", response_model=list[PriceHistoryRead])
def list_price_history(
    cost_item_id: int | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[PriceHistory]:
    query = db.query(PriceHistory)
    if cost_item_id is not None:
        query = query.filter(PriceHistory.cost_item_id == cost_item_id)
    return query.order_by(PriceHistory.valid_from.desc()).all()


@router.post("/price-history", response_model=PriceHistoryRead, status_code=status.HTTP_201_CREATED)
def create_price_history(
    payload: PriceHistoryCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> PriceHistory:
    if not db.get(CostItem, payload.cost_item_id):
        raise HTTPException(status_code=400, detail="Kostenposition nicht gefunden")
    entry = PriceHistory(**payload.model_dump())
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.get("/document-links", response_model=list[DocumentLinkRead])
def list_document_links(
    cost_item_id: int | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[DocumentLink]:
    query = db.query(DocumentLink)
    if cost_item_id is not None:
        query = query.filter(DocumentLink.cost_item_id == cost_item_id)
    return query.order_by(DocumentLink.title).all()


@router.post("/document-links", response_model=DocumentLinkRead, status_code=status.HTTP_201_CREATED)
def create_document_link(
    payload: DocumentLinkCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> DocumentLink:
    if not db.get(CostItem, payload.cost_item_id):
        raise HTTPException(status_code=400, detail="Kostenposition nicht gefunden")
    link = DocumentLink(**payload.model_dump())
    db.add(link)
    db.commit()
    db.refresh(link)
    return link


@router.patch("/document-links/{link_id}", response_model=DocumentLinkRead)
def update_document_link(
    link_id: int,
    payload: DocumentLinkUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> DocumentLink:
    link = db.get(DocumentLink, link_id)
    if not link:
        raise HTTPException(status_code=404, detail="Dokumentenlink nicht gefunden")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(link, key, value)
    db.commit()
    db.refresh(link)
    return link


@router.delete("/document-links/{link_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document_link(
    link_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> None:
    link = db.get(DocumentLink, link_id)
    if not link:
        raise HTTPException(status_code=404, detail="Dokumentenlink nicht gefunden")
    db.delete(link)
    db.commit()
