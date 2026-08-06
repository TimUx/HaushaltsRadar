from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas import DashboardSummary
from app.services.analytics import AnalyticsService

router = APIRouter(prefix="/analytics", tags=["Analytics"])


class FilterOption(BaseModel):
    id: int
    name: str
    party_id: int | None = None
    person_id: int | None = None


class FilterOptions(BaseModel):
    persons: list[FilterOption]
    parties: list[FilterOption]
    objects: list[FilterOption]


class StructureMember(BaseModel):
    id: int
    name: str
    type: str
    objects: list["StructureMember"] = []


class StructureParty(BaseModel):
    id: int
    name: str
    description: str | None = None
    persons: list[StructureMember]
    objects: list[StructureMember]


class StructureOverview(BaseModel):
    root_name: str
    parties: list[StructureParty]
    unassigned_persons: list[StructureMember]
    unassigned_objects: list[StructureMember]


class CostOverviewRow(BaseModel):
    id: int
    name: str
    description: str | None = None
    category: str | None = None
    subcategory: str | None = None
    object: str | None = None
    object_party: str | None = None
    object_person: str | None = None
    contract_partner: str | None = None
    amount: Decimal
    currency: str
    payment_interval: str
    payment_interval_label: str
    monthly_amount: Decimal
    yearly_amount: Decimal
    due_label: str
    due_day: int | None = None
    due_month: int | None = None
    allocations: str
    contract_provider: str | None = None
    contract_number: str | None = None
    contract_notice_days: int | None = None
    contract_auto_renewal: bool | None = None
    contract_start: date | None = None
    contract_end: date | None = None
    notes: str | None = None
    start_date: date | None = None
    end_date: date | None = None


@router.get("/filter-options", response_model=FilterOptions)
def filter_options(db: Session = Depends(get_db)) -> FilterOptions:
    """Öffentliche Filteroptionen für Dashboard."""
    data = AnalyticsService(db).filter_options()
    return FilterOptions(**data)


@router.get("/structure", response_model=StructureOverview)
def structure_overview(db: Session = Depends(get_db)) -> StructureOverview:
    """Öffentliches Organigramm: Parteien, Personen und Objekte."""
    return StructureOverview(**AnalyticsService(db).structure())


@router.get("/cost-overview", response_model=list[CostOverviewRow])
def cost_overview(db: Session = Depends(get_db)) -> list[CostOverviewRow]:
    """Öffentliche tabellarische Kostenübersicht mit allen Details."""
    return [CostOverviewRow(**row) for row in AnalyticsService(db).cost_overview()]


@router.get("/dashboard", response_model=DashboardSummary)
def dashboard_summary(
    db: Session = Depends(get_db),
    object_id: int | None = Query(default=None, description="Nur Kosten dieses Objekts"),
    person_id: int | None = Query(default=None, description="Nur Anteil dieser Person"),
    party_id: int | None = Query(default=None, description="Nur Anteil dieser Partei"),
    household: bool = Query(default=False, description="Nur allgemeiner Haushaltsanteil"),
) -> DashboardSummary:
    """Öffentliche aggregierte Kennzahlen für das Dashboard (ohne Auth)."""
    try:
        return AnalyticsService(db).dashboard_summary(
            object_id=object_id,
            person_id=person_id,
            party_id=party_id,
            household=household,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
