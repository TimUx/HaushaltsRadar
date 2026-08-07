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
        """
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_interval')
               AND NOT EXISTS (
                   SELECT 1 FROM pg_enum e
                   JOIN pg_type t ON t.oid = e.enumtypid
                   WHERE t.typname = 'payment_interval' AND e.enumlabel = 'one_time'
               ) THEN
                ALTER TYPE payment_interval ADD VALUE 'one_time';
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'entry_type') THEN
                CREATE TYPE entry_type AS ENUM ('expense', 'income');
            END IF;
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'cost_items' AND column_name = 'entry_type'
            ) THEN
                ALTER TABLE cost_items
                    ADD COLUMN entry_type entry_type NOT NULL DEFAULT 'expense'::entry_type;
            END IF;
        END $$
        """,
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'users' AND column_name = 'person_id'
            ) THEN
                ALTER TABLE users
                    ADD COLUMN person_id INTEGER REFERENCES persons(id) ON DELETE SET NULL;
                CREATE INDEX IF NOT EXISTS ix_users_person_id ON users(person_id);
            END IF;
        END $$
        """,
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255)",
        "ALTER TABLE persons ADD COLUMN IF NOT EXISTS email VARCHAR(255)",
        """
        CREATE TABLE IF NOT EXISTS smtp_settings (
            id SERIAL PRIMARY KEY,
            enabled BOOLEAN NOT NULL DEFAULT FALSE,
            host VARCHAR(255),
            port INTEGER NOT NULL DEFAULT 587,
            use_tls BOOLEAN NOT NULL DEFAULT TRUE,
            use_ssl BOOLEAN NOT NULL DEFAULT FALSE,
            username VARCHAR(255),
            password VARCHAR(500),
            from_email VARCHAR(255),
            from_name VARCHAR(200),
            default_cc_email VARCHAR(255),
            remind_days_before VARCHAR(100) NOT NULL DEFAULT '30,14,7,1',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS reminder_logs (
            id SERIAL PRIMARY KEY,
            contract_id INTEGER NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
            reminder_type VARCHAR(40) NOT NULL,
            target_date DATE NOT NULL,
            lead_days INTEGER NOT NULL,
            recipients TEXT,
            sent_at TIMESTAMPTZ NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT uq_reminder_contract_type_target_lead
                UNIQUE (contract_id, reminder_type, target_date, lead_days)
        )
        """,
        "CREATE INDEX IF NOT EXISTS ix_reminder_logs_contract_id ON reminder_logs(contract_id)",
        "ALTER TABLE smtp_settings ADD COLUMN IF NOT EXISTS notify_notice_deadline BOOLEAN NOT NULL DEFAULT TRUE",
        "ALTER TABLE smtp_settings ADD COLUMN IF NOT EXISTS notify_contract_end BOOLEAN NOT NULL DEFAULT TRUE",
        "ALTER TABLE smtp_settings ADD COLUMN IF NOT EXISTS notify_contract_start BOOLEAN NOT NULL DEFAULT FALSE",
        "ALTER TABLE smtp_settings ADD COLUMN IF NOT EXISTS notify_price_change BOOLEAN NOT NULL DEFAULT FALSE",
        "ALTER TABLE smtp_settings ADD COLUMN IF NOT EXISTS notify_one_time BOOLEAN NOT NULL DEFAULT FALSE",
        "ALTER TABLE smtp_settings ADD COLUMN IF NOT EXISTS notify_due_dates BOOLEAN NOT NULL DEFAULT FALSE",
        "ALTER TABLE reminder_logs ADD COLUMN IF NOT EXISTS subject_key VARCHAR(80)",
        """
        UPDATE reminder_logs
        SET subject_key = 'contract:' || contract_id::text
        WHERE subject_key IS NULL AND contract_id IS NOT NULL
        """,
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'reminder_logs' AND column_name = 'subject_key'
            ) THEN
                ALTER TABLE reminder_logs ALTER COLUMN subject_key SET DEFAULT '';
                UPDATE reminder_logs SET subject_key = 'legacy:' || id::text WHERE subject_key IS NULL OR subject_key = '';
                ALTER TABLE reminder_logs ALTER COLUMN subject_key SET NOT NULL;
            END IF;
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'reminder_logs' AND column_name = 'contract_id'
            ) THEN
                ALTER TABLE reminder_logs ALTER COLUMN contract_id DROP NOT NULL;
            END IF;
            IF EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'uq_reminder_contract_type_target_lead'
            ) THEN
                ALTER TABLE reminder_logs DROP CONSTRAINT uq_reminder_contract_type_target_lead;
            END IF;
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'uq_reminder_subject_type_target_lead'
            ) THEN
                ALTER TABLE reminder_logs
                    ADD CONSTRAINT uq_reminder_subject_type_target_lead
                    UNIQUE (subject_key, reminder_type, target_date, lead_days);
            END IF;
        END $$
        """,
        "CREATE INDEX IF NOT EXISTS ix_reminder_logs_subject_key ON reminder_logs(subject_key)",
        "ALTER TABLE contracts ADD COLUMN IF NOT EXISTS initial_term_months INTEGER",
        "ALTER TABLE contracts ADD COLUMN IF NOT EXISTS renewal_term_months INTEGER",
        "ALTER TABLE contracts ADD COLUMN IF NOT EXISTS renewal_notice_period_days INTEGER",
        """
        CREATE TABLE IF NOT EXISTS password_reset_tokens (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            token_hash VARCHAR(128) NOT NULL UNIQUE,
            expires_at TIMESTAMPTZ NOT NULL,
            used_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """,
        "CREATE INDEX IF NOT EXISTS ix_password_reset_tokens_user_id ON password_reset_tokens(user_id)",
        "CREATE INDEX IF NOT EXISTS ix_password_reset_tokens_token_hash ON password_reset_tokens(token_hash)",
    ]
    with engine.begin() as conn:
        for statement in statements:
            conn.execute(text(statement))
        for statement in migrate_statements:
            conn.execute(text(statement))
