# Developer-Guide – HaushaltsRadar

Architektur, lokale Entwicklung und Erweiterungspunkte.

## Architektur

```
frontend (React/Vite/MUI)
    │  REST + JWT
    ▼
backend (FastAPI)
    │  SQLAlchemy
    ▼
PostgreSQL
```

Backend-Schichten:

| Ordner | Rolle |
|--------|--------|
| `backend/app/api/v1/` | HTTP-Router |
| `backend/app/services/` | Business-Logik (Amounts, Analytics, Reports, Data Transfer, …) |
| `backend/app/repositories/` | Datenzugriff |
| `backend/app/models/` | SQLAlchemy-Modelle |
| `backend/app/schemas/` | Pydantic-DTOs |
| `backend/alembic/` | Migrationen |

Frontend:

| Ordner | Rolle |
|--------|--------|
| `frontend/src/pages/` | Routen/Seiten |
| `frontend/src/charts/` | ECharts-Optionen |
| `frontend/src/api/` | API-Client |
| `frontend/src/auth/` | JWT-Context & ProtectedRoute |
| `frontend/src/layouts/` | Navigation / Shell |

## Datenmodell (Kern)

- **CostItem** – Ausgabe/Einnahme, Intervall (inkl. `one_time`), Betrag, Fälligkeit
- **CostAllocation** – Prozentanteile (Haushalt / Personen / Parteien)
- **Contract**, PriceHistory, DocumentLink – Verträge (Beginn + `initial_term_months`, optional Verlängerung via `renewal_term_months` / `renewal_notice_period_days`; Berechnung in `services/contract_terms.py`)
- **Category** / **Subcategory**, **Tag**, **Person**, **Party**, **Object**
- **User** – Rollen `admin` | `user` | `viewer`, optional `person_id` für „Meine Finanzen“

Monats-/Jahresbeträge: `backend/app/services/amounts.py`.  
Vertragslaufzeiten / Kündigungstermine: `backend/app/services/contract_terms.py` (wird von API und Erinnerungen genutzt).

## Docker

Standard (GHCR-Images):

```bash
cp .env.example .env
export HAUSHALTSRADAR_VERSION=latest
docker compose up -d
```

Lokale Entwicklung mit Hot-Reload:

```bash
docker compose -f docker-compose.dev.yml up --build
```

CI: Bei `release: published` baut `.github/workflows/release-ghcr.yml` Backend/Frontend multi-arch nach `ghcr.io/timux/haushaltsradar-*`. Manuell: Actions → *Release GHCR images* → *Run workflow*.
## Lokale Entwicklung

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# DB z. B. nur Postgres aus Compose:
# docker compose up -d postgresql

export POSTGRES_HOST=localhost
export SECRET_KEY=dev-secret
export BOOTSTRAP_ADMIN_USERNAME=admin
export BOOTSTRAP_ADMIN_PASSWORD=admin
uvicorn app.main:app --reload --port 8000
```

Migrationen:

```bash
cd backend
alembic upgrade head
```

Beim Start: Bootstrap legt fehlende Tabellen an, seedet Kategorien und den Admin-Benutzer (`SEED_SAMPLE_DATA` steuert Beispieldaten).

Tests:

```bash
cd backend && .venv/bin/pytest -q
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Dev-Server: http://localhost:5173 (Proxy auf Backend `:8000`).  
`VITE_API_BASE_URL` standardmäßig `/api/v1`.

Build:

```bash
npm run build
```

## Auth & API

- Login: `POST /api/v1/auth/login` (OAuth2 Password) bzw. `/auth/login/json`
- Access- + Refresh-Token (JWT); Gültigkeit über `ACCESS_TOKEN_EXPIRE_MINUTES` / `REFRESH_TOKEN_EXPIRE_DAYS`
- Rollenprüfung: `require_admin` / rollenbasierte Dependencies in `app/api/deps.py`
- OpenAPI interaktiv: http://localhost:8000/docs

Wichtige Endpunkte (Auszug):

| Bereich | Pfad |
|---------|------|
| Health | `GET /api/v1/health` |
| Dashboard | `GET /api/v1/analytics/dashboard` |
| Charts | `GET /api/v1/analytics/breakdown|hierarchy|heatmap|flow` |
| Periodenbericht | `GET /api/v1/reports/period` |
| Cost Items | `/api/v1/cost-items` |
| Admin Export/Import | `/api/v1/admin/export`, `/api/v1/admin/import` |

## Erweiterungsideen

1. Neues Feld am Modell → Alembic-Migration → Schema → Service → API → Frontend-Form
2. Neues Diagramm → Analytics-Service + Endpoint → `frontend/src/charts/*` + AnalysesPage
3. Neuer Report → `ReportService` + ReportsPage / PDF-Helfer

## Coding-Hinweise

- UI-Sprache ist Deutsch
- Beträge als `Decimal` im Backend; Frontend formatiert lokal
- Keine Secrets committen (`.env` bleibt lokal; `.env.example` als Vorlage)
- Vor PR: Backend-Tests (`pytest`) und Frontend-Build (`npm run build`)

Siehe auch die ältere Kurzfassung in [../DEVELOPMENT.md](../DEVELOPMENT.md) – dieser Guide ist die aktuelle Referenz.
