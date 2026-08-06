"""Link persons and objects to parties

Revision ID: 0004_party_links
Revises: 0003_parties
Create Date: 2026-08-06
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0004_party_links"
down_revision: Union[str, None] = "0003_parties"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "persons",
        sa.Column("party_id", sa.Integer(), sa.ForeignKey("parties.id", ondelete="SET NULL"), nullable=True),
    )
    op.add_column(
        "objects",
        sa.Column("party_id", sa.Integer(), sa.ForeignKey("parties.id", ondelete="SET NULL"), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("objects", "party_id")
    op.drop_column("persons", "party_id")
