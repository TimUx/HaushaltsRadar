"""Contract term months and renewal notice fields."""

from alembic import op
import sqlalchemy as sa

revision = "0013_contract_terms"
down_revision = "0012_notify_toggles"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("contracts", sa.Column("initial_term_months", sa.Integer(), nullable=True))
    op.add_column("contracts", sa.Column("renewal_term_months", sa.Integer(), nullable=True))
    op.add_column(
        "contracts", sa.Column("renewal_notice_period_days", sa.Integer(), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("contracts", "renewal_notice_period_days")
    op.drop_column("contracts", "renewal_term_months")
    op.drop_column("contracts", "initial_term_months")
