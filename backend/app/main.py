from contextlib import asynccontextmanager

from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1 import api_router
from app.core.config import get_settings
from app.core.logging import setup_logging
from app.db.base import Base
from app.db.schema import ensure_schema
from app.db.session import SessionLocal, engine
from app.services.bootstrap import ensure_bootstrap_admin, seed_categories
from app.services.cost_history import backfill_missing_history
from app.services.reminders import run_reminders_job
from app.services.sample_data import seed_sample_data
import app.models  # noqa: F401

_scheduler: BackgroundScheduler | None = None


def create_app(*, run_bootstrap: bool = True) -> FastAPI:
    settings = get_settings()

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        global _scheduler
        setup_logging()
        if run_bootstrap:
            Base.metadata.create_all(bind=engine)
            ensure_schema(engine)
            db = SessionLocal()
            try:
                seed_categories(db)
                ensure_bootstrap_admin(db)
                if settings.seed_sample_data:
                    seed_sample_data(db)
                backfill_missing_history(db)
            finally:
                db.close()

            _scheduler = BackgroundScheduler(timezone="Europe/Berlin")
            _scheduler.add_job(
                run_reminders_job,
                trigger="cron",
                hour=7,
                minute=0,
                id="contract_reminders",
                replace_existing=True,
            )
            _scheduler.start()
        try:
            yield
        finally:
            if _scheduler is not None:
                _scheduler.shutdown(wait=False)
                _scheduler = None

    app = FastAPI(
        title=settings.app_name,
        version="1.1.2",
        description="Open-Source Fixkostenverwaltung für Privathaushalte",
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(api_router, prefix=settings.api_v1_prefix)
    return app


app = create_app()
