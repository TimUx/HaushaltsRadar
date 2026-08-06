from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import User
from app.services.reports import ReportService

router = APIRouter(prefix="/reports", tags=["Berichte"])


class ReportNamedAmount(BaseModel):
    id: int | None = None
    name: str
    amount: float | str


class ReportSummary(BaseModel):
    expense_total: float | str
    income_total: float | str
    net_total: float | str
    one_time_expense: float | str
    one_time_income: float | str
    active_items: int


class ReportMonthPoint(BaseModel):
    month: str
    label: str
    expense: float | str
    income: float | str
    net: float | str


class PeriodReport(BaseModel):
    title: str
    period_type: str
    period_label: str
    date_from: str
    date_to: str
    months_covered: int
    generated_at: str
    comment: str | None = None
    summary: ReportSummary
    by_category: list[ReportNamedAmount]
    by_object: list[ReportNamedAmount]
    by_person: list[ReportNamedAmount]
    by_party: list[ReportNamedAmount]
    top_items: list[ReportNamedAmount]
    monthly_series: list[ReportMonthPoint]


@router.get("/period", response_model=PeriodReport)
def period_report(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
    period_type: str = Query(default="year", description="month|quarter|half|year|custom"),
    year: int | None = Query(default=None),
    month: int | None = Query(default=None, ge=1, le=12),
    quarter: int | None = Query(default=None, ge=1, le=4),
    half: int | None = Query(default=None, ge=1, le=2),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    object_id: int | None = Query(default=None),
    person_id: int | None = Query(default=None),
    party_id: int | None = Query(default=None),
    household: bool = Query(default=False),
    category_id: int | None = Query(default=None),
    tag_id: int | None = Query(default=None),
    comment: str | None = Query(default=None, max_length=2000),
) -> PeriodReport:
    """Aggregierter Periodenbericht für PDF-Export."""
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
    try:
        data = ReportService(db).build_report(
            period_type=period_type,
            year=year,
            month=month,
            quarter=quarter,
            half=half,
            date_from=date_from,
            date_to=date_to,
            object_id=object_id,
            person_id=person_id,
            party_id=party_id,
            household=household,
            category_id=category_id,
            tag_id=tag_id,
            comment=comment,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return PeriodReport(**data)
