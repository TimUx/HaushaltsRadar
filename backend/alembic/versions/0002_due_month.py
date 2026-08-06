"""Add due_month to cost_items

Revision ID: 0002_due_month
Revises: 0001_initial
Create Date: 2026-08-06
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0002_due_month"
down_revision: Union[str, None] = "0001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("cost_items", sa.Column("due_month", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("cost_items", "due_month")
