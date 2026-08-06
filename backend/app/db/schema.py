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
        """
        CREATE TABLE IF NOT EXISTS tags (
            id SERIAL PRIMARY KEY,
            name VARCHAR(100) NOT NULL UNIQUE,
            color VARCHAR(20),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS cost_item_tags (
            cost_item_id INTEGER NOT NULL REFERENCES cost_items(id) ON DELETE CASCADE,
            tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
            PRIMARY KEY (cost_item_id, tag_id)
        )
        """,
    ]
    migrate_statements = [
        """
        INSERT INTO tags (name)
        SELECT DISTINCT s.name
        FROM subcategories s
        WHERE NOT EXISTS (SELECT 1 FROM tags t WHERE t.name = s.name)
        """,
        """
        INSERT INTO cost_item_tags (cost_item_id, tag_id)
        SELECT ci.id, t.id
        FROM cost_items ci
        JOIN subcategories s ON s.id = ci.subcategory_id
        JOIN tags t ON t.name = s.name
        WHERE NOT EXISTS (
            SELECT 1 FROM cost_item_tags cit
            WHERE cit.cost_item_id = ci.id AND cit.tag_id = t.id
        )
        """,
        "UPDATE cost_items SET subcategory_id = NULL WHERE subcategory_id IS NOT NULL",
        """
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
                CREATE TYPE user_role AS ENUM ('admin', 'user', 'viewer');
            END IF;
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'users' AND column_name = 'role'
            ) THEN
                ALTER TABLE users ADD COLUMN role user_role;
            END IF;
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'users' AND column_name = 'is_admin'
            ) THEN
                UPDATE users
                SET role = CASE
                    WHEN is_admin THEN 'admin'::user_role
                    ELSE COALESCE(role, 'user'::user_role)
                END;
                ALTER TABLE users ALTER COLUMN role SET DEFAULT 'user'::user_role;
                UPDATE users SET role = 'user'::user_role WHERE role IS NULL;
                ALTER TABLE users ALTER COLUMN role SET NOT NULL;
                ALTER TABLE users DROP COLUMN is_admin;
            ELSE
                UPDATE users SET role = 'user'::user_role WHERE role IS NULL;
                ALTER TABLE users ALTER COLUMN role SET DEFAULT 'user'::user_role;
                ALTER TABLE users ALTER COLUMN role SET NOT NULL;
            END IF;
        END $$
        """,
        """
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cost_history_event') THEN
                CREATE TYPE cost_history_event AS ENUM ('created', 'changed', 'ended', 'reactivated');
            END IF;
        END $$
        """,
        "ALTER TABLE price_history ADD COLUMN IF NOT EXISTS monthly_amount NUMERIC(12,2) DEFAULT 0 NOT NULL",
        "ALTER TABLE price_history ADD COLUMN IF NOT EXISTS event_type cost_history_event DEFAULT 'changed'::cost_history_event",
        """
        UPDATE price_history
        SET monthly_amount = amount
        WHERE monthly_amount = 0 OR monthly_amount IS NULL
        """,
        """
        UPDATE price_history
        SET event_type = 'changed'::cost_history_event
        WHERE event_type IS NULL
        """,
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'price_history' AND column_name = 'event_type'
            ) THEN
                ALTER TABLE price_history ALTER COLUMN event_type SET DEFAULT 'changed'::cost_history_event;
                ALTER TABLE price_history ALTER COLUMN event_type SET NOT NULL;
            END IF;
        END $$
        """,
    ]
    with engine.begin() as conn:
        for statement in statements:
            conn.execute(text(statement))
        for statement in migrate_statements:
            conn.execute(text(statement))
