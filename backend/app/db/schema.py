from sqlalchemy import text
from sqlalchemy.engine import Engine


def ensure_schema(engine: Engine) -> None:
    """Apply lightweight additive schema fixes for existing databases."""
    statements = [
        "ALTER TABLE cost_items ADD COLUMN IF NOT EXISTS due_month INTEGER",
        """
        CREATE TABLE IF NOT EXISTS parties (
            id SERIAL PRIMARY KEY,
            name VARCHAR(100) NOT NULL UNIQUE,
            description TEXT,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """,
        "ALTER TABLE cost_allocations ADD COLUMN IF NOT EXISTS party_id INTEGER "
        "REFERENCES parties(id) ON DELETE SET NULL",
        "ALTER TABLE persons ADD COLUMN IF NOT EXISTS party_id INTEGER "
        "REFERENCES parties(id) ON DELETE SET NULL",
        "ALTER TABLE objects ADD COLUMN IF NOT EXISTS party_id INTEGER "
        "REFERENCES parties(id) ON DELETE SET NULL",
        "ALTER TABLE objects ADD COLUMN IF NOT EXISTS person_id INTEGER "
        "REFERENCES persons(id) ON DELETE SET NULL",
    ]
    with engine.begin() as conn:
        for statement in statements:
            conn.execute(text(statement))
