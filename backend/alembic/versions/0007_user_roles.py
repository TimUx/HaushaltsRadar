"""Add user roles

Revision ID: 0007_user_roles
Revises: 0006_tags
Create Date: 2026-08-06
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0007_user_roles"
down_revision: Union[str, None] = "0006_tags"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    user_role = sa.Enum("admin", "user", "viewer", name="user_role")
    user_role.create(op.get_bind(), checkfirst=True)
    op.add_column(
        "users",
        sa.Column("role", user_role, nullable=False, server_default="user"),
    )
    op.execute(
        sa.text(
            """
            UPDATE users
            SET role = CASE WHEN is_admin THEN 'admin'::user_role ELSE 'user'::user_role END
            """
        )
    )
    op.drop_column("users", "is_admin")


def downgrade() -> None:
    op.add_column(
        "users",
        sa.Column("is_admin", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.execute(
        sa.text(
            """
            UPDATE users
            SET is_admin = CASE WHEN role::text = 'admin' THEN TRUE ELSE FALSE END
            """
        )
    )
    op.drop_column("users", "role")
    sa.Enum(name="user_role").drop(op.get_bind(), checkfirst=True)
