"""SMTP settings, emails on users/persons, reminder logs."""

from alembic import op
import sqlalchemy as sa

revision = "0011_smtp_reminders"
down_revision = "0010_user_person"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("email", sa.String(length=255), nullable=True))
    op.add_column("persons", sa.Column("email", sa.String(length=255), nullable=True))
    op.create_table(
        "smtp_settings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("host", sa.String(length=255), nullable=True),
        sa.Column("port", sa.Integer(), nullable=False, server_default="587"),
        sa.Column("use_tls", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("use_ssl", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("username", sa.String(length=255), nullable=True),
        sa.Column("password", sa.String(length=500), nullable=True),
        sa.Column("from_email", sa.String(length=255), nullable=True),
        sa.Column("from_name", sa.String(length=200), nullable=True),
        sa.Column("default_cc_email", sa.String(length=255), nullable=True),
        sa.Column(
            "remind_days_before",
            sa.String(length=100),
            nullable=False,
            server_default="30,14,7,1",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_table(
        "reminder_logs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "contract_id",
            sa.Integer(),
            sa.ForeignKey("contracts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("reminder_type", sa.String(length=40), nullable=False),
        sa.Column("target_date", sa.Date(), nullable=False),
        sa.Column("lead_days", sa.Integer(), nullable=False),
        sa.Column("recipients", sa.Text(), nullable=True),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.UniqueConstraint(
            "contract_id",
            "reminder_type",
            "target_date",
            "lead_days",
            name="uq_reminder_contract_type_target_lead",
        ),
    )
    op.create_index("ix_reminder_logs_contract_id", "reminder_logs", ["contract_id"])


def downgrade() -> None:
    op.drop_index("ix_reminder_logs_contract_id", table_name="reminder_logs")
    op.drop_table("reminder_logs")
    op.drop_table("smtp_settings")
    op.drop_column("persons", "email")
    op.drop_column("users", "email")
