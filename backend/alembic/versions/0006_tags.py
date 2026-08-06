"""Introduce tags and migrate subcategories

Revision ID: 0006_tags
Revises: 0005_object_person
Create Date: 2026-08-06
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0006_tags"
down_revision: Union[str, None] = "0005_object_person"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "tags",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=100), nullable=False, unique=True),
        sa.Column("color", sa.String(length=20), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_table(
        "cost_item_tags",
        sa.Column("cost_item_id", sa.Integer(), sa.ForeignKey("cost_items.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("tag_id", sa.Integer(), sa.ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
    )

    conn = op.get_bind()
    # Promote unique subcategory names to tags and link existing cost items.
    conn.execute(
        sa.text(
            """
            INSERT INTO tags (name)
            SELECT DISTINCT s.name
            FROM subcategories s
            WHERE NOT EXISTS (SELECT 1 FROM tags t WHERE t.name = s.name)
            ORDER BY s.name
            """
        )
    )
    conn.execute(
        sa.text(
            """
            INSERT INTO cost_item_tags (cost_item_id, tag_id)
            SELECT ci.id, t.id
            FROM cost_items ci
            JOIN subcategories s ON s.id = ci.subcategory_id
            JOIN tags t ON t.name = s.name
            ON CONFLICT DO NOTHING
            """
        )
    )
    conn.execute(sa.text("UPDATE cost_items SET subcategory_id = NULL WHERE subcategory_id IS NOT NULL"))


def downgrade() -> None:
    op.drop_table("cost_item_tags")
    op.drop_table("tags")
