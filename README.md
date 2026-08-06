# HaushaltsRadar

Selbst gehostete Web-App für **Fixkosten, Verträge und wiederkehrende Ausgaben** im Haushalt – inklusive Einnahmen, Analysen und Periodenberichten.

HaushaltsRadar ist **kein** klassisches Haushaltsbuch und **keine** Banking-Software. Es modelliert Fixkosten, Abos, Versicherungen und ähnliche Positionen, verteilt sie auf Personen/Parteien und macht sie über Dashboards und Diagramme nachvollziehbar.

![Dashboard](docs/screenshots/01-dashboard.png)

*Screenshots zeigen fiktive Demo-Daten (`docs/demo/screenshot-demo-data.json`), keine Echtdaten.*

## Funktionen

| Bereich | Was du damit machst |
|---------|---------------------|
| **Dashboard** | Monatliche und hochgerechnete Jahres-KPIs (Ausgaben, Einnahmen, Netto), Kategorie- und Top-Kosten-Charts, Parteienvergleich, Fälligkeiten |
| **Analysen** | Verteilung, Vergleich, Verlauf, Hierarchie, Heatmap und Flussdiagramme – filterbar nach Objekt, Kategorie, Tag, Person, Partei |
| **Berichte** | Periodenberichte (Monat, Quartal, Halbjahr, Jahr, Zeitraum) mit PDF-Export |
| **Posten** | Ausgaben & Einnahmen, Intervalle (monatlich bis jährlich, einmalig, custom), Anteile, Tags, Objekte |
| **Verträge** | Vertragsstammdaten und Verknüpfung zu Kostenpositionen |
| **Organisation** | Personen, Parteien, Objekte, Kategorien, Tags |
| **Meine Finanzen** | Persönliche Sicht über verknüpfte Person (User ↔ Person) |
| **Historie / Struktur / Übersicht** | Kostenverlauf, Strukturansicht und tabellarische Kostenübersicht |
| **Administration** | Benutzer & Rollen (`admin` / `user` / `viewer`), JSON-Export/Import und Backup/Restore |
| **PWA** | Als Progressive Web App nutzbar (Light/Dark Mode) |

![Analysen](docs/screenshots/02-analysen.png)

![Berichte](docs/screenshots/03-berichte.png)

## Schnellstart

Voraussetzungen: Docker und Docker Compose.

```bash
git clone https://github.com/TimUx/HaushaltsRadar.git
cd HaushaltsRadar
cp .env.example .env
# SECRET_KEY und Bootstrap-Passwort in .env anpassen
docker compose up --build
```

| Dienst | URL |
|--------|-----|
| Frontend | http://localhost:3080 |
| API / OpenAPI | http://localhost:8000/docs |

Standard-Login (änderbar in `.env`): **`admin` / `admin`**

Optionale Demo-Daten: `SEED_SAMPLE_DATA=true` in `.env` (Standard in `.env.example`).

### Fertige Images (GHCR)

Bei jedem GitHub-Release werden Backend- und Frontend-Images nach GHCR gebaut (`linux/amd64`, `linux/arm64`):

- `ghcr.io/timux/haushaltsradar-backend`
- `ghcr.io/timux/haushaltsradar-frontend`

```bash
cp .env.example .env
export HAUSHALTSRADAR_VERSION=1.0.0   # oder latest
docker compose -f docker-compose.ghcr.yml up -d
```

Tags pro Release u. a.: `v1.0.0`, `1.0.0`, `1.0`, `latest` (kein Prerelease).

## Dokumentation

| Guide | Für wen |
|-------|---------|
| [Benutzerhandbuch](docs/guides/USER.md) | Alltag: Posten, Filter, Analysen, Berichte |
| [Admin-Guide](docs/guides/ADMIN.md) | Benutzer, Backup, Deployment, Sicherheit |
| [Developer-Guide](docs/guides/DEVELOPER.md) | Architektur, lokale Entwicklung, API, Tests |

## Stack

| Schicht | Technologie |
|---------|-------------|
| Backend | Python, FastAPI, SQLAlchemy, Alembic, PostgreSQL, Pydantic |
| Frontend | React, TypeScript, Vite, Material UI, TanStack Query, Apache ECharts, jsPDF |
| Deploy | Docker Compose |

## Zugriffsmodell

| Rolle | Rechte |
|-------|--------|
| **viewer** | Lesen: Dashboard, Analysen, Berichte, Übersichten |
| **user** | Zusätzlich: Posten, Verträge, Stammdaten pflegen |
| **admin** | Zusätzlich: Benutzerverwaltung, Datenexport/-import & Backup |

## Lizenz

MIT – siehe [LICENSE](LICENSE).
