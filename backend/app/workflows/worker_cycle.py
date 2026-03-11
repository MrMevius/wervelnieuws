from sqlalchemy.orm import Session

from app.services.retry_service import RetryService
from app.workflows.publishing_workflow import PublishingWorkflow


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
            else:
                raise RuntimeError(f"Unknown retry flow: {job.flow_name}")
        except Exception as exc:
            retry_service.mark_failed_with_error(job, type(exc).__name__, str(exc))
