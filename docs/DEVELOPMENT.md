# Entwicklerdokumentation

## Architektur

```
frontend (React)  --REST/JWT-->  backend (FastAPI)  -->  PostgreSQL
```

- Repository Pattern unter `backend/app/repositories`
- Business-Logik unter `backend/app/services`
- Pydantic-Schemas unter `backend/app/schemas`
- SQLAlchemy-Modelle unter `backend/app/models`

## Datenmodell (Kern)

- **CostItem** – Fixkostenposition mit Intervall, Betrag, Fälligkeit
- **CostAllocation** – Prozentverteilung auf Haushalt und/oder Personen
- **Contract** / **PriceHistory** / **DocumentLink** – Vertragsverwaltung und Paperless-Vorbereitung
- **Category** / **Subcategory** – inkl. Seed der Standardkategorien

Monats-/Jahresbeträge werden im Service `amounts.py` aus Intervall berechnet.

## Migrationen

```bash
cd backend
alembic upgrade head
```

Beim App-Start legt der Bootstrap zusätzlich fehlende Tabellen an (`create_all`) und seeded Kategorien sowie den Admin-Benutzer.

## Auth

JWT Access- und Refresh-Token. Bootstrap-Admin aus Umgebungsvariablen:

- `BOOTSTRAP_ADMIN_USERNAME`
- `BOOTSTRAP_ADMIN_PASSWORD`
