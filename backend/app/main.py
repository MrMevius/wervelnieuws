from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import admin, auth, boards, content, database, health, meta, topics
from app.core.logging import configure_logging
from app.core.settings import (
    get_settings,
    parse_allowed_origins,
    validate_runtime_security,
)

configure_logging()
settings = get_settings()
validate_runtime_security(settings)

allow_origins = parse_allowed_origins(settings.allowed_origins)

app = FastAPI(title=settings.app_name)
app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(auth.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(topics.router, prefix="/api")
app.include_router(content.router, prefix="/api")
app.include_router(database.router, prefix="/api")
app.include_router(meta.router, prefix="/api")
app.include_router(boards.router, prefix="/api")
