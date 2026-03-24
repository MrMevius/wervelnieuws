from sqlalchemy.orm import Session

from app.services.worker_lease_service import WorkerLeaseService
from app.services.notification_service import NotificationService
from app.services.retry_service import RetryService
from app.workflows.publishing_workflow import PublishingWorkflow

WORKER_CYCLE_LOCK_KEY = "publish_worker_cycle"


def run_worker_cycle(db: Session) -> None:
    workflow = PublishingWorkflow(db)
    workflow.publish_due()

    retry_service = RetryService(db)
    for job in retry_service.due_jobs():
        retry_service.mark_in_progress(job)
        try:
            if job.flow_name == "publish_schedule":
                handled = workflow.retry_publish_for_topic(job.topic_id)
                if not handled:
                    raise RuntimeError("No retryable schedule found")
                retry_service.mark_resolved(job)
            elif job.flow_name.startswith("notification_delivery:"):
                notification_id = job.flow_name.split(":", 1)[1]
                delivered = NotificationService(db).deliver_or_queue(notification_id)
                if not delivered:
                    raise RuntimeError("Notification delivery failed")
                retry_service.mark_resolved(job)
            else:
                raise RuntimeError(f"Unknown retry flow: {job.flow_name}")
        except Exception as exc:
            retry_service.mark_failed_with_error(job, type(exc).__name__, str(exc))


def run_worker_cycle_guarded(db: Session, *, owner_id: str, lease_seconds: int) -> bool:
    lease_service = WorkerLeaseService(db)
    acquired = lease_service.acquire(
        lock_key=WORKER_CYCLE_LOCK_KEY,
        owner_id=owner_id,
        lease_seconds=lease_seconds,
    )
    if not acquired:
        return False

    try:
        run_worker_cycle(db)
        return True
    finally:
        lease_service.release(lock_key=WORKER_CYCLE_LOCK_KEY, owner_id=owner_id)
