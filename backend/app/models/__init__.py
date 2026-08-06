from __future__ import annotations

import enum
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class PaymentInterval(str, enum.Enum):
    monthly = "monthly"
    bimonthly = "bimonthly"
    quarterly = "quarterly"
    semiannual = "semiannual"
    annual = "annual"
    custom = "custom"


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class Person(Base, TimestampMixin):
    __tablename__ = "persons"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    color: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    party_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("parties.id", ondelete="SET NULL"), nullable=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    party: Mapped[Optional[Party]] = relationship(back_populates="persons")
    allocations: Mapped[list[CostAllocation]] = relationship(back_populates="person")
    objects: Mapped[list[ObjectEntity]] = relationship(back_populates="person")


class Party(Base, TimestampMixin):
    """Named living party / floor household within one installation."""

    __tablename__ = "parties"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    persons: Mapped[list[Person]] = relationship(back_populates="party")
    objects: Mapped[list[ObjectEntity]] = relationship(back_populates="party")
    allocations: Mapped[list[CostAllocation]] = relationship(back_populates="party")


class ObjectEntity(Base, TimestampMixin):
    """Named ObjectEntity to avoid clash with Python's object builtin."""

    __tablename__ = "objects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(150), unique=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    party_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("parties.id", ondelete="SET NULL"), nullable=True
    )
    person_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("persons.id", ondelete="SET NULL"), nullable=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    party: Mapped[Optional[Party]] = relationship(back_populates="objects")
    person: Mapped[Optional[Person]] = relationship(back_populates="objects")
    cost_items: Mapped[list[CostItem]] = relationship(back_populates="object")


class Category(Base, TimestampMixin):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    subcategories: Mapped[list[Subcategory]] = relationship(
        back_populates="category", cascade="all, delete-orphan"
    )
    cost_items: Mapped[list[CostItem]] = relationship(back_populates="category")


class Subcategory(Base, TimestampMixin):
    __tablename__ = "subcategories"
    __table_args__ = (UniqueConstraint("category_id", "name", name="uq_subcategory_category_name"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    category: Mapped[Category] = relationship(back_populates="subcategories")
    cost_items: Mapped[list[CostItem]] = relationship(back_populates="subcategory")


class CostItem(Base, TimestampMixin):
    __tablename__ = "cost_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id"), nullable=False)
    subcategory_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("subcategories.id"), nullable=True
    )
    object_id: Mapped[Optional[int]] = mapped_column(ForeignKey("objects.id"), nullable=True)
    contract_partner: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="EUR", nullable=False)
    payment_interval: Mapped[PaymentInterval] = mapped_column(
        Enum(
            PaymentInterval,
            name="payment_interval",
            values_callable=lambda enum: [item.value for item in enum],
        ),
        nullable=False,
    )
    custom_interval_months: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    start_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    end_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    due_day: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    due_month: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    category: Mapped[Category] = relationship(back_populates="cost_items")
    subcategory: Mapped[Optional[Subcategory]] = relationship(back_populates="cost_items")
    object: Mapped[Optional[ObjectEntity]] = relationship(back_populates="cost_items")
    allocations: Mapped[list[CostAllocation]] = relationship(
        back_populates="cost_item", cascade="all, delete-orphan"
    )
    contract: Mapped[Optional[Contract]] = relationship(
        back_populates="cost_item", uselist=False, cascade="all, delete-orphan"
    )
    price_history: Mapped[list[PriceHistory]] = relationship(
        back_populates="cost_item", cascade="all, delete-orphan"
    )
    document_links: Mapped[list[DocumentLink]] = relationship(
        back_populates="cost_item", cascade="all, delete-orphan"
    )


class CostAllocation(Base, TimestampMixin):
    __tablename__ = "cost_allocations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    cost_item_id: Mapped[int] = mapped_column(
        ForeignKey("cost_items.id", ondelete="CASCADE"), nullable=False
    )
    person_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("persons.id", ondelete="SET NULL"), nullable=True
    )
    party_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("parties.id", ondelete="SET NULL"), nullable=True
    )
    is_household: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    percentage: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)

    cost_item: Mapped[CostItem] = relationship(back_populates="allocations")
    person: Mapped[Optional[Person]] = relationship(back_populates="allocations")
    party: Mapped[Optional[Party]] = relationship(back_populates="allocations")


class Contract(Base, TimestampMixin):
    __tablename__ = "contracts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    cost_item_id: Mapped[int] = mapped_column(
        ForeignKey("cost_items.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    provider: Mapped[str] = mapped_column(String(200), nullable=False)
    contract_number: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    start_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    end_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    notice_period_days: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    auto_renewal: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    cost_item: Mapped[CostItem] = relationship(back_populates="contract")


class PriceHistory(Base, TimestampMixin):
    __tablename__ = "price_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    cost_item_id: Mapped[int] = mapped_column(
        ForeignKey("cost_items.id", ondelete="CASCADE"), nullable=False
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    valid_from: Mapped[date] = mapped_column(Date, nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    cost_item: Mapped[CostItem] = relationship(back_populates="price_history")


class DocumentLink(Base, TimestampMixin):
    __tablename__ = "document_links"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    cost_item_id: Mapped[int] = mapped_column(
        ForeignKey("cost_items.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    paperless_document_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    cost_item: Mapped[CostItem] = relationship(back_populates="document_links")
