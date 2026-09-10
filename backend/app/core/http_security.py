"""Origin checks for cookie-authenticated writes and private API response headers."""

from urllib.parse import urlsplit

from starlette.datastructures import MutableHeaders
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.core.settings import get_settings, parse_allowed_origins


def _origin(url: str) -> str:
    try:
        parsed = urlsplit(url)
        if (
            parsed.scheme not in {"http", "https"} or not parsed.hostname
            or parsed.username or parsed.password
        ):
            return ""
        port = parsed.port or (443 if parsed.scheme == "https" else 80)
        return f"{parsed.scheme}://{parsed.hostname}:{port}"
    except ValueError:
        return ""


def _untrusted_browser_write(request: Request) -> bool:
    if request.method in {"GET", "HEAD", "OPTIONS"}:
        return False
    settings = get_settings()
    # Explicit bearer credentials do not depend on ambient browser cookies.
    bearer = request.headers.get("authorization", "").lower().startswith("bearer ")
    has_session = (
        request.cookies.get(settings.auth_cookie_name)
        or request.cookies.get(settings.remember_cookie_name)
    )
    if request.url.path != "/api/auth/login" and (bearer or not has_session):
        return False
    allowed = {
        _origin(value) for value in parse_allowed_origins(settings.allowed_origins)
    } - {""}
    if settings.env.strip().lower() not in {"production", "prod"}:
        allowed.add(_origin(str(request.base_url)))
    source = request.headers.get("origin")
    if source is not None:
        return _origin(source) not in allowed
    referer = request.headers.get("referer")
    if referer is not None:
        return _origin(referer) not in allowed
    # Non-browser clients need not send Origin; browsers flag cross-site requests.
    return request.headers.get("sec-fetch-site") == "cross-site"


class HttpSecurityMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or not scope["path"].startswith("/api/"):
            await self.app(scope, receive, send)
            return

        async def secure_send(message: Message) -> None:
            if message["type"] == "http.response.start":
                headers = MutableHeaders(scope=message)
                headers["Cache-Control"] = "no-store"
                headers["X-Content-Type-Options"] = "nosniff"
                headers["Referrer-Policy"] = "same-origin"
            await send(message)

        if _untrusted_browser_write(Request(scope)):
            response = JSONResponse(
                status_code=403, content={"detail": "Request origin is not allowed"},
            )
            await response(scope, receive, secure_send)
            return
        await self.app(scope, receive, secure_send)
