from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models import EntryType, PaymentInterval


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# --- Auth ---


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class LoginRequest(BaseModel):
    username: str
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class UserRead(ORMModel):
    id: int
    username: str
    role: str
    is_active: bool
    person_id: Optional[int] = None
    created_at: datetime


class UserCreate(BaseModel):
    username: str = Field(min_length=2, max_length=100)
    password: str = Field(min_length=6, max_length=200)
    role: str = "user"
    is_active: bool = True
    person_id: Optional[int] = None


class UserUpdate(BaseModel):
    username: Optional[str] = Field(default=None, min_length=2, max_length=100)
    password: Optional[str] = Field(default=None, min_length=6, max_length=200)
    role: Optional[str] = None
    is_active: Optional[bool] = None
    person_id: Optional[int] = None


# --- Person ---


class PersonBase(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    color: Optional[str] = None
    notes: Optional[str] = None
    party_id: Optional[int] = None
    is_active: bool = True


class PersonCreate(PersonBase):
    pass


class PersonUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    color: Optional[str] = None
    notes: Optional[str] = None
    party_id: Optional[int] = None
    is_active: Optional[bool] = None


class PersonRead(PersonBase, ORMModel):
    id: int
    created_at: datetime
    updated_at: datetime


# --- Party ---


class PartyBase(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: Optional[str] = None
    is_active: bool = True


class PartyCreate(PartyBase):
    pass


class PartyUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    description: Optional[str] = None
    is_active: Optional[bool] = None


class PartyRead(PartyBase, ORMModel):
    id: int
    created_at: datetime
    updated_at: datetime


# --- Object ---


class ObjectBase(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    description: Optional[str] = None
    party_id: Optional[int] = None
    person_id: Optional[int] = None
    is_active: bool = True


class ObjectCreate(ObjectBase):
    pass


class ObjectUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=150)
    description: Optional[str] = None
    party_id: Optional[int] = None
    person_id: Optional[int] = None
    is_active: Optional[bool] = None


class ObjectRead(ObjectBase, ORMModel):
    id: int
    created_at: datetime
    updated_at: datetime


# --- Category ---


class CategoryBase(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    sort_order: int = 0


class CategoryCreate(CategoryBase):
    pass


class CategoryUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    sort_order: Optional[int] = None


class CategoryRead(CategoryBase, ORMModel):
    id: int
    created_at: datetime
    updated_at: datetime


# --- Tag ---


class TagBase(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    color: Optional[str] = None


class TagCreate(TagBase):
    pass


class TagUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    color: Optional[str] = None


class TagRead(TagBase, ORMModel):
    id: int
    created_at: datetime
    updated_at: datetime


# --- Cost allocation ---


class CostAllocationBase(BaseModel):
    person_id: Optional[int] = None
    party_id: Optional[int] = None
    is_household: bool = False
    percentage: Decimal = Field(ge=0, le=100)


class CostAllocationCreate(CostAllocationBase):
    pass


class CostAllocationRead(CostAllocationBase, ORMModel):
    id: int
    cost_item_id: int


# --- Cost item ---


class CostItemBase(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: Optional[str] = None
    category_id: int
    object_id: Optional[int] = None
    contract_partner: Optional[str] = None
    amount: Decimal = Field(gt=0)
    currency: str = "EUR"
    entry_type: EntryType = EntryType.expense
    payment_interval: PaymentInterval
    custom_interval_months: Optional[int] = Field(default=None, ge=1)
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    due_day: Optional[int] = Field(default=None, ge=1, le=31)
    due_month: Optional[int] = Field(default=None, ge=1, le=12)
    notes: Optional[str] = None
    is_active: bool = True


class CostItemCreate(CostItemBase):
    tag_ids: list[int] = []
    allocations: list[CostAllocationCreate] = []


class CostItemUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = None
    category_id: Optional[int] = None
    object_id: Optional[int] = None
    contract_partner: Optional[str] = None
    amount: Optional[Decimal] = Field(default=None, gt=0)
    currency: Optional[str] = None
    entry_type: Optional[EntryType] = None
    payment_interval: Optional[PaymentInterval] = None
    custom_interval_months: Optional[int] = Field(default=None, ge=1)
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    due_day: Optional[int] = Field(default=None, ge=1, le=31)
    due_month: Optional[int] = Field(default=None, ge=1, le=12)
    notes: Optional[str] = None
    is_active: Optional[bool] = None
    tag_ids: Optional[list[int]] = None
    allocations: Optional[list[CostAllocationCreate]] = None
    # Effective date for amount/interval changes in price history (default: today)
    price_valid_from: Optional[date] = None
    price_change_notes: Optional[str] = None


class CostItemRead(CostItemBase, ORMModel):
    id: int
    tags: list[TagRead] = []
    allocations: list[CostAllocationRead] = []
    monthly_amount: Decimal
    yearly_amount: Decimal
    created_at: datetime
    updated_at: datetime


# --- Contract ---


class ContractBase(BaseModel):
    cost_item_id: int
    provider: str = Field(min_length=1, max_length=200)
    contract_number: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    notice_period_days: Optional[int] = Field(default=None, ge=0)
    auto_renewal: bool = True
    notes: Optional[str] = None


class ContractCreate(ContractBase):
    pass


class ContractUpdate(BaseModel):
    provider: Optional[str] = Field(default=None, min_length=1, max_length=200)
    contract_number: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    notice_period_days: Optional[int] = Field(default=None, ge=0)
    auto_renewal: Optional[bool] = None
    notes: Optional[str] = None


class ContractRead(ContractBase, ORMModel):
    id: int
    created_at: datetime
    updated_at: datetime


# --- Price history ---


class PriceHistoryBase(BaseModel):
    cost_item_id: int
    amount: Decimal = Field(ge=0)
    monthly_amount: Decimal = Field(ge=0)
    valid_from: date
    event_type: str = "changed"
    notes: Optional[str] = None


class PriceHistoryCreate(PriceHistoryBase):
    pass


class PriceHistoryEntryCreate(BaseModel):
    """Create a price point for an existing cost item (cost_item_id from path)."""

    amount: Decimal = Field(gt=0)
    valid_from: date
    notes: Optional[str] = None
    event_type: str = "changed"
    sync_current_amount: bool = True


class PriceHistoryRead(PriceHistoryBase, ORMModel):
    id: int
    created_at: datetime


class CostHistoryPoint(BaseModel):
    month: str
    date: date
    monthly_total: Decimal
    is_forecast: bool = False


class CostHistoryEventRead(BaseModel):
    date: date
    cost_item_id: int
    cost_item_name: str
    event_type: str
    amount: Decimal
    monthly_amount: Decimal
    notes: Optional[str] = None


class CostHistorySummary(BaseModel):
    current_monthly: Decimal
    start_monthly: Decimal
    change_monthly: Decimal
    change_percent: Decimal
    active_items: int
    months_back: int
    forecast_months: int


class CostHistoryResponse(BaseModel):
    series: list[CostHistoryPoint]
    events: list[CostHistoryEventRead]
    summary: CostHistorySummary


# --- Document link ---


class DocumentLinkBase(BaseModel):
    cost_item_id: int
    title: str = Field(min_length=1, max_length=200)
    url: Optional[str] = None
    paperless_document_id: Optional[int] = None
    notes: Optional[str] = None


class DocumentLinkCreate(DocumentLinkBase):
    pass


class DocumentLinkUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    url: Optional[str] = None
    paperless_document_id: Optional[int] = None
    notes: Optional[str] = None


class DocumentLinkRead(DocumentLinkBase, ORMModel):
    id: int
    created_at: datetime


# --- Analytics ---


class NamedAmount(BaseModel):
    id: Optional[int] = None
    name: str
    amount: Decimal


class UpcomingDue(BaseModel):
    cost_item_id: int
    name: str
    due_day: Optional[int]
    due_month: Optional[int] = None
    due_label: str
    amount: Decimal
    payment_interval: PaymentInterval
    entry_type: EntryType = EntryType.expense


class BreakdownResponse(BaseModel):
    group_by: str
    items: list[NamedAmount]


class HierarchyNode(BaseModel):
    id: int | str | None = None
    name: str
    value: Decimal
    children: list["HierarchyNode"] = []


class HierarchyResponse(BaseModel):
    mode: str
    nodes: list[HierarchyNode]


class HeatmapResponse(BaseModel):
    year: int
    categories: list[str]
    months: list[str]
    values: list[list[float]]


class SankeyNode(BaseModel):
    name: str


class SankeyLink(BaseModel):
    source: str
    target: str
    value: float


class FlowResponse(BaseModel):
    nodes: list[SankeyNode]
    links: list[SankeyLink]


class DashboardSummary(BaseModel):
    year: int
    monthly_fixed_costs: Decimal
    yearly_fixed_costs: Decimal
    monthly_income: Decimal
    yearly_income: Decimal
    monthly_net: Decimal
    yearly_net: Decimal
    ytd_fixed_costs: Decimal
    ytd_income: Decimal
    one_time_expense: Decimal
    one_time_income: Decimal
    active_contracts: int
    active_cost_items: int
    costs_by_person: list[NamedAmount]
    costs_by_party: list[NamedAmount]
    costs_by_object: list[NamedAmount]
    costs_by_category: list[NamedAmount]
    top_cost_blocks: list[NamedAmount]
    upcoming_dues: list[UpcomingDue]
