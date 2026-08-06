from fastapi import APIRouter

from app.api.v1 import (
    analytics,
    auth,
    categories,
    contracts,
    cost_items,
    objects,
    parties,
    persons,
    tags,
    users,
)

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(analytics.router)
api_router.include_router(users.router)
api_router.include_router(persons.router)
api_router.include_router(parties.router)
api_router.include_router(objects.router)
api_router.include_router(categories.router)
api_router.include_router(tags.router)
api_router.include_router(cost_items.router)
api_router.include_router(contracts.router)


@api_router.get("/health", tags=["System"])
def health() -> dict[str, str]:
    return {"status": "ok", "service": "kostenpilot-backend"}
