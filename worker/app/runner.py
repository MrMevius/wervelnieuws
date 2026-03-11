import time

from app.core.db import SessionLocal
from app.core.settings import get_settings
from app.workflows.worker_cycle import run_worker_cycle


def run() -> None:
    settings = get_settings()
    while True:
        db = SessionLocal()
        try:
            run_worker_cycle(db)
        finally:
            db.close()
        time.sleep(settings.scheduler_poll_seconds)


if __name__ == "__main__":
    run()
