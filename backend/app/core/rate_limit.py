import threading
import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request, status

from app.core.settings import get_settings


class InMemoryRateLimiter:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._events: dict[str, deque[float]] = defaultdict(deque)

    def check(self, key: str) -> None:
        settings = get_settings()
        now = time.time()
        window_start = now - settings.rate_limit_window_seconds
        with self._lock:
            queue = self._events[key]
            while queue and queue[0] < window_start:
                queue.popleft()
            if len(queue) >= settings.rate_limit_max_requests:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Rate limit exceeded",
                )
            queue.append(now)


limiter = InMemoryRateLimiter()


def rate_limit(request: Request) -> None:
    client_host = request.client.host if request.client else "unknown"
    limiter.check(f"{client_host}:{request.url.path}")
