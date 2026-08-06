"""Extend price history for timeline tracking

Revision ID: 0008_cost_history
Revises: 0007_user_roles
Create Date: 2026-08-06
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0008_cost_history"
down_revision: Union[str, None] = "0007_user_roles"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    event = sa.Enum("created", "changed", "ended", "reactivated", name="cost_history_event")
    event.create(op.get_bind(), checkfirst=True)
    op.add_column(
        "price_history",
        sa.Column("monthly_amount", sa.Numeric(12, 2), nullable=False, server_default="0"),
    )
    op.add_column(
        "price_history",
        sa.Column("event_type", event, nullable=False, server_default="changed"),
    )
    op.execute(
        sa.text(
            """
            UPDATE price_history ph
            SET monthly_amount = ph.amount
            WHERE monthly_amount = 0
            """
        )
    )


def downgrade() -> None:
    op.drop_column("price_history", "event_type")
    op.drop_column("price_history", "monthly_amount")
    sa.Enum(name="cost_history_event").drop(op.get_bind(), checkfirst=True)
