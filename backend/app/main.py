from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1 import api_router
from app.core.config import get_settings
from app.core.logging import setup_logging
from app.db.base import Base
from app.db.schema import ensure_schema
from app.db.session import SessionLocal, engine
from app.services.bootstrap import ensure_bootstrap_admin, seed_categories
from app.services.sample_data import seed_sample_data
import app.models  # noqa: F401


def create_app(*, run_bootstrap: bool = True) -> FastAPI:
    settings = get_settings()

    @asynccontextmanager
    async def lifespan(_: FastAPI):
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
            finally:
                db.close()
        yield

    app = FastAPI(
        title=settings.app_name,
        version="0.1.0",
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
