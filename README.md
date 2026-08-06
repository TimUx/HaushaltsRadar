# KostenPilot

Open-Source-Webanwendung zur Verwaltung, Analyse und Visualisierung privater Fixkosten und wiederkehrender Ausgaben.

KostenPilot ist **kein** Haushaltsbuch und **keine** Banking-Software. Es verwaltet Fixkosten, Verträge, Versicherungen, Abonnements und ähnliche wiederkehrende Ausgaben – selbst gehostet.

## Features (MVP)

- Öffentliches Dashboard mit KPIs und Diagrammen (ohne Login)
- Authentifizierte Verwaltung: Kosten, Verträge, Personen, Objekte, Kategorien
- Kostenverteilung (Haushalt / Personen in Prozent)
- REST API mit OpenAPI (`/docs`)
- Light/Dark Mode, schlichtes flaches UI
- Docker Compose Deployment

## Stack

| Schicht | Technologie |
|---------|-------------|
| Backend | Python, FastAPI, SQLAlchemy, Alembic, PostgreSQL, Pydantic |
| Frontend | React, TypeScript, Vite, Material UI, React Router, TanStack Query, Apache ECharts |
| Deploy | Docker Compose |

## Schnellstart mit Docker

```bash
cp .env.example .env
docker compose up --build
```

- Frontend: http://localhost:3080  
- API / OpenAPI: http://localhost:8000/docs  
- Standard-Login: `admin` / `admin` (über `.env` änderbar)

## Entwicklung

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# PostgreSQL benötigt (z. B. via docker compose up postgresql)
export POSTGRES_HOST=localhost
export SECRET_KEY=dev-secret
uvicorn app.main:app --reload --port 8000
```

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

Dev-Server: http://localhost:5173 (API-Proxy auf Port 8000)

### Dev-Compose

```bash
docker compose -f docker-compose.dev.yml up --build
```

## Zugriffsmodell

| Bereich | Auth |
|---------|------|
| Dashboard & Analytics-API | öffentlich |
| CRUD, Details, Administration | JWT erforderlich |

## API-Überblick

- `GET /api/v1/health` – Healthcheck
- `GET /api/v1/analytics/dashboard` – öffentliche Kennzahlen
- `POST /api/v1/auth/login` – OAuth2 Password Flow
- `POST /api/v1/auth/login/json` – JSON-Login
- Geschützt: `/persons`, `/objects`, `/categories`, `/cost-items`, `/contracts`, …

## Lizenz

MIT – siehe [LICENSE](LICENSE).
