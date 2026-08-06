"""Add entry_type and one_time payment interval

Revision ID: 0009_entry_type_one_time
Revises: 0008_cost_history
Create Date: 2026-08-06
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0009_entry_type_one_time"
down_revision: Union[str, None] = "0008_cost_history"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(sa.text("ALTER TYPE payment_interval ADD VALUE IF NOT EXISTS 'one_time'"))

    entry_type = sa.Enum("expense", "income", name="entry_type")
    entry_type.create(op.get_bind(), checkfirst=True)
    op.add_column(
        "cost_items",
        sa.Column("entry_type", entry_type, nullable=False, server_default="expense"),
    )


def downgrade() -> None:
    op.drop_column("cost_items", "entry_type")
    sa.Enum(name="entry_type").drop(op.get_bind(), checkfirst=True)
    # Postgres cannot easily remove enum values from payment_interval
