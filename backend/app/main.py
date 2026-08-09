from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.exception_handlers import request_validation_exception_handler
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from app.api import admin, auth, boards, content, database, health, meta, topics, work_hours
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


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError):
    if request.url.path.startswith("/api/urenverantwoording"):
        return JSONResponse(
            status_code=422,
            content={
                "detail": {
                    "code": "work_hours_validation_error",
                    "message": "Controleer de ingevoerde gegevens.",
                    "errors": [
                        {"location": ".".join(str(part) for part in error["loc"]), "message": error["msg"]}
                        for error in exc.errors()
                    ],
                }
            },
        )
    return await request_validation_exception_handler(request, exc)
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
app.include_router(work_hours.router, prefix="/api")
