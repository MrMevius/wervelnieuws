from datetime import UTC, datetime, timedelta

from sqlalchemy.orm import Session

from app.models.entities import RetryJob
from app.models.enums import RetryStatus


class RetryService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def due_jobs(self) -> list[RetryJob]:
        now = datetime.now(UTC)
        return (
            self.db.query(RetryJob)
            .filter(RetryJob.status.in_([RetryStatus.queued, RetryStatus.failed]))
            .filter(RetryJob.next_run_at <= now)
            .all()
        )

    def mark_failed(self, job: RetryJob) -> None:
        job.attempt += 1
        if job.attempt >= job.max_attempts:
            job.status = RetryStatus.failed
        else:
            job.status = RetryStatus.queued
            job.next_run_at = datetime.now(UTC) + timedelta(minutes=2**job.attempt)
        self.db.add(job)
        self.db.commit()

    def mark_in_progress(self, job: RetryJob) -> None:
        job.status = RetryStatus.in_progress
        self.db.add(job)
        self.db.commit()

    def mark_failed_with_error(
        self, job: RetryJob, error_type: str, error_message: str
    ) -> None:
        job.error_type = error_type
        job.error_message = error_message
        self.mark_failed(job)

    def mark_resolved(self, job: RetryJob) -> None:
        job.status = RetryStatus.resolved
        self.db.add(job)
        self.db.commit()
