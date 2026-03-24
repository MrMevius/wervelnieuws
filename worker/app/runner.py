import time
import uuid

from app.core.db import SessionLocal
from app.core.settings import get_settings
from app.workflows.worker_cycle import run_worker_cycle_guarded


def run() -> None:
    settings = get_settings()
    owner_id = f"worker-{uuid.uuid4().hex}"
    while True:
        db = SessionLocal()
        try:
            run_worker_cycle_guarded(
                db,
                owner_id=owner_id,
                lease_seconds=settings.worker_lease_seconds,
            )
        finally:
            db.close()
        time.sleep(settings.scheduler_poll_seconds)


if __name__ == "__main__":
    run()
