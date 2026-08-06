from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import User
from app.schemas import (
    BreakdownResponse,
    CostHistoryResponse,
    DashboardSummary,
    FlowResponse,
    HeatmapResponse,
    HierarchyResponse,
)
from app.services.analytics import AnalyticsService
from app.services.cost_history import cost_history_timeline
from app.services.cost_history import backfill_missing_history as backfill_history

router = APIRouter(prefix="/analytics", tags=["Analytics"])


def _share_conflict(
    person_id: int | None,
    party_id: int | None,
    household: bool,
) -> None:
    filters_set = sum(
        [
            1 if person_id is not None else 0,
            1 if party_id is not None else 0,
            1 if household else 0,
        ]
    )
    if filters_set > 1:
        raise HTTPException(
            status_code=400,
            detail="person_id, party_id und household können nicht gleichzeitig gesetzt sein",
        )


class FilterOption(BaseModel):
    id: int
    name: str
    party_id: int | None = None
    person_id: int | None = None


class FilterOptions(BaseModel):
    persons: list[FilterOption]
    parties: list[FilterOption]
    objects: list[FilterOption]
    categories: list[FilterOption]
    tags: list[FilterOption]
    years: list[int] = []


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
    category_id: int | None = None
    tags: str | None = None
    tag_ids: list[int] = []
    object: str | None = None
    object_party: str | None = None
    object_person: str | None = None
    object_person_id: int | None = None
    related_person_ids: list[int] = []
    contract_partner: str | None = None
    amount: Decimal
    currency: str
    entry_type: str = "expense"
    entry_type_label: str = "Ausgabe"
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
def filter_options(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> FilterOptions:
    """Filteroptionen für Dashboard und Historie."""
    data = AnalyticsService(db).filter_options()
    return FilterOptions(**data)


@router.get("/structure", response_model=StructureOverview)
def structure_overview(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> StructureOverview:
    """Organigramm: Parteien, Personen und Objekte."""
    return StructureOverview(**AnalyticsService(db).structure())


@router.get("/cost-overview", response_model=list[CostOverviewRow])
def cost_overview(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[CostOverviewRow]:
    """Tabellarische Kostenübersicht mit allen Details."""
    return [CostOverviewRow(**row) for row in AnalyticsService(db).cost_overview()]


@router.get("/cost-history", response_model=CostHistoryResponse)
def cost_history(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
    months_back: int = Query(default=12, ge=3, le=60),
    forecast_months: int = Query(default=6, ge=0, le=24),
    object_id: int | None = Query(default=None),
    category_id: int | None = Query(default=None),
    tag_id: int | None = Query(default=None),
    person_id: int | None = Query(default=None),
    party_id: int | None = Query(default=None),
    household: bool = Query(default=False),
) -> CostHistoryResponse:
    """Kostenverlauf inkl. Prognose und Ereignisliste."""
    filters_set = sum(
        [
            1 if person_id is not None else 0,
            1 if party_id is not None else 0,
            1 if household else 0,
        ]
    )
    if filters_set > 1:
        raise HTTPException(
            status_code=400,
            detail="person_id, party_id und household können nicht gleichzeitig gesetzt sein",
        )
    backfill_history(db)
    data = cost_history_timeline(
        db,
        months_back=months_back,
        forecast_months=forecast_months,
        object_id=object_id,
        category_id=category_id,
        tag_id=tag_id,
        person_id=person_id,
        party_id=party_id,
        household=household,
    )
    return CostHistoryResponse(**data)


@router.get("/dashboard", response_model=DashboardSummary)
def dashboard_summary(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
    year: int | None = Query(default=None, description="Kalenderjahr für die Auswertung"),
    object_id: int | None = Query(default=None, description="Nur Kosten dieses Objekts"),
    person_id: int | None = Query(default=None, description="Nur Anteil dieser Person"),
    party_id: int | None = Query(default=None, description="Nur Anteil dieser Partei"),
    household: bool = Query(default=False, description="Nur allgemeiner Haushaltsanteil"),
    category_id: int | None = Query(default=None, description="Nur Kosten dieser Kategorie"),
    tag_id: int | None = Query(default=None, description="Nur Kosten mit diesem Tag"),
) -> DashboardSummary:
    """Aggregierte Kennzahlen für das Dashboard."""
    try:
        return AnalyticsService(db).dashboard_summary(
            year=year,
            object_id=object_id,
            person_id=person_id,
            party_id=party_id,
            household=household,
            category_id=category_id,
            tag_id=tag_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/breakdown", response_model=BreakdownResponse)
def chart_breakdown(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
    group_by: str = Query(default="category"),
    year: int | None = Query(default=None),
    object_id: int | None = Query(default=None),
    person_id: int | None = Query(default=None),
    party_id: int | None = Query(default=None),
    household: bool = Query(default=False),
    category_id: int | None = Query(default=None),
    tag_id: int | None = Query(default=None),
) -> BreakdownResponse:
    _share_conflict(person_id, party_id, household)
    try:
        data = AnalyticsService(db).breakdown(
            group_by=group_by,
            year=year,
            object_id=object_id,
            person_id=person_id,
            party_id=party_id,
            household=household,
            category_id=category_id,
            tag_id=tag_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return BreakdownResponse(**data)


@router.get("/hierarchy", response_model=HierarchyResponse)
def chart_hierarchy(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
    mode: str = Query(default="category"),
    year: int | None = Query(default=None),
    object_id: int | None = Query(default=None),
    person_id: int | None = Query(default=None),
    party_id: int | None = Query(default=None),
    household: bool = Query(default=False),
    category_id: int | None = Query(default=None),
    tag_id: int | None = Query(default=None),
) -> HierarchyResponse:
    _share_conflict(person_id, party_id, household)
    try:
        data = AnalyticsService(db).hierarchy(
            mode=mode,
            year=year,
            object_id=object_id,
            person_id=person_id,
            party_id=party_id,
            household=household,
            category_id=category_id,
            tag_id=tag_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return HierarchyResponse(**data)


@router.get("/heatmap", response_model=HeatmapResponse)
def chart_heatmap(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
    year: int | None = Query(default=None),
    object_id: int | None = Query(default=None),
    person_id: int | None = Query(default=None),
    party_id: int | None = Query(default=None),
    household: bool = Query(default=False),
    category_id: int | None = Query(default=None),
    tag_id: int | None = Query(default=None),
) -> HeatmapResponse:
    _share_conflict(person_id, party_id, household)
    try:
        data = AnalyticsService(db).heatmap(
            year=year,
            object_id=object_id,
            person_id=person_id,
            party_id=party_id,
            household=household,
            category_id=category_id,
            tag_id=tag_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return HeatmapResponse(**data)


@router.get("/flow", response_model=FlowResponse)
def chart_flow(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
    year: int | None = Query(default=None),
    object_id: int | None = Query(default=None),
    person_id: int | None = Query(default=None),
    party_id: int | None = Query(default=None),
    household: bool = Query(default=False),
    category_id: int | None = Query(default=None),
    tag_id: int | None = Query(default=None),
) -> FlowResponse:
    _share_conflict(person_id, party_id, household)
    try:
        data = AnalyticsService(db).flow(
            year=year,
            object_id=object_id,
            person_id=person_id,
            party_id=party_id,
            household=household,
            category_id=category_id,
            tag_id=tag_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return FlowResponse(**data)
