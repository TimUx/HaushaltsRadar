"""Link users to persons for personal finance views

Revision ID: 0010_user_person
Revises: 0009_entry_type_one_time
Create Date: 2026-08-06
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0010_user_person"
down_revision: Union[str, None] = "0009_entry_type_one_time"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("person_id", sa.Integer(), nullable=True))
    op.create_index("ix_users_person_id", "users", ["person_id"])
    op.create_foreign_key(
        "fk_users_person_id_persons",
        "users",
        "persons",
        ["person_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_users_person_id_persons", "users", type_="foreignkey")
    op.drop_index("ix_users_person_id", table_name="users")
    op.drop_column("users", "person_id")
