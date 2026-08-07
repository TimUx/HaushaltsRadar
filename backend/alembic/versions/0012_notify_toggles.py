"""Expand SMTP notification toggles and generalize reminder logs."""

from alembic import op
import sqlalchemy as sa

revision = "0012_notify_toggles"
down_revision = "0011_smtp_reminders"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "smtp_settings",
        sa.Column("notify_notice_deadline", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.add_column(
        "smtp_settings",
        sa.Column("notify_contract_end", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.add_column(
        "smtp_settings",
        sa.Column("notify_contract_start", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        "smtp_settings",
        sa.Column("notify_price_change", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        "smtp_settings",
        sa.Column("notify_one_time", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        "smtp_settings",
        sa.Column("notify_due_dates", sa.Boolean(), nullable=False, server_default=sa.false()),
    )

    op.add_column("reminder_logs", sa.Column("subject_key", sa.String(length=80), nullable=True))
    op.execute(
        """
        UPDATE reminder_logs
        SET subject_key = 'contract:' || contract_id::text
        WHERE subject_key IS NULL
        """
    )
    op.alter_column("reminder_logs", "subject_key", nullable=False)
    op.alter_column("reminder_logs", "contract_id", existing_type=sa.Integer(), nullable=True)
    op.drop_constraint("uq_reminder_contract_type_target_lead", "reminder_logs", type_="unique")
    op.create_unique_constraint(
        "uq_reminder_subject_type_target_lead",
        "reminder_logs",
        ["subject_key", "reminder_type", "target_date", "lead_days"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_reminder_subject_type_target_lead", "reminder_logs", type_="unique")
    op.execute("DELETE FROM reminder_logs WHERE contract_id IS NULL")
    op.alter_column("reminder_logs", "contract_id", existing_type=sa.Integer(), nullable=False)
    op.create_unique_constraint(
        "uq_reminder_contract_type_target_lead",
        "reminder_logs",
        ["contract_id", "reminder_type", "target_date", "lead_days"],
    )
    op.drop_column("reminder_logs", "subject_key")
    op.drop_column("smtp_settings", "notify_due_dates")
    op.drop_column("smtp_settings", "notify_one_time")
    op.drop_column("smtp_settings", "notify_price_change")
    op.drop_column("smtp_settings", "notify_contract_start")
    op.drop_column("smtp_settings", "notify_contract_end")
    op.drop_column("smtp_settings", "notify_notice_deadline")
