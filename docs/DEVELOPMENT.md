# Entwicklerdokumentation

Die vollständige Entwicklerdokumentation steht im **[Developer-Guide](guides/DEVELOPER.md)**.

Kurzüberblick:

```
frontend (React)  --REST/JWT-->  backend (FastAPI)  -->  PostgreSQL
```

- Repository Pattern: `backend/app/repositories`
- Business-Logik: `backend/app/services`
- Schemas: `backend/app/schemas`
- Modelle: `backend/app/models`

Migrationen: `cd backend && alembic upgrade head`

Bootstrap-Admin: `BOOTSTRAP_ADMIN_USERNAME` / `BOOTSTRAP_ADMIN_PASSWORD`
