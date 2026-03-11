from datetime import UTC, datetime

from sqlalchemy import update
from sqlalchemy.orm import Session

from app.integrations.publishers import (
    FacebookPublisher,
    MailgunPublisher,
    TelegramNotifier,
    WebsitePublisher,
)
from app.models.entities import (
    ChannelPublicationState,
    ContentVersion,
    PublicationRecord,
    PublicationSchedule,
    RetryJob,
    Topic,
)
from app.models.enums import (
    ChannelName,
    ChannelPublishState,
    RetryStatus,
    WorkflowState,
)


class PublishingWorkflow:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.website = WebsitePublisher()
        self.facebook = FacebookPublisher()
        self.mailgun = MailgunPublisher()
        self.telegram = TelegramNotifier()

    def publish_due(self) -> int:
        now = datetime.now(UTC)
        schedules = (
            self.db.query(PublicationSchedule)
            .filter(PublicationSchedule.status == WorkflowState.scheduled)
            .filter(PublicationSchedule.scheduled_for <= now)
            .all()
        )
        claimed = 0
        for schedule in schedules:
            if self._claim_schedule(schedule.id):
                claimed += 1
                self._publish_schedule(schedule.id)
        return claimed

    def _publish_schedule(self, schedule_id: str) -> None:
        schedule = self.db.get(PublicationSchedule, schedule_id)
        if not schedule:
            return
        topic = self.db.get(Topic, schedule.topic_id)
        version = self.db.get(ContentVersion, schedule.content_version_id)
        if not topic or not version:
            return

        topic.workflow_state = WorkflowState.publishing
        self.db.add(topic)
        self.db.commit()

        record = (
            self.db.query(PublicationRecord)
            .filter(PublicationRecord.schedule_id == schedule.id)
            .first()
        )
        if not record:
            record = PublicationRecord(
                schedule_id=schedule.id,
                topic_id=topic.id,
                content_version_id=version.id,
            )
            self.db.add(record)
            self.db.flush()

        for channel in (
            ChannelName.website,
            ChannelName.facebook,
            ChannelName.newsletter,
        ):
            state_row = self._find_state(record.id, channel)
            if not state_row:
                state_row = ChannelPublicationState(
                    publication_record_id=record.id,
                    channel=channel,
                    state=ChannelPublishState.pending,
                )
            state_row.state = ChannelPublishState.publishing
            self.db.add(state_row)
        self.db.commit()

        try:
            website_state = self._find_state(record.id, ChannelName.website)
            if not website_state:
                raise RuntimeError("Website channel state missing")
            website_payload = {
                "title": version.title,
                "slug": version.slug,
                "article_body": version.article_body,
                "summary": version.summary,
                "image": version.generated_image.image_path
                if version.generated_image
                else "",
                "publication_timestamp": schedule.scheduled_for.isoformat(),
                "version_number": version.version_number,
                "topic_identifier": topic.id,
                "is_update": version.is_published,
            }
            website_state.external_id = self.website.publish(website_payload)
            website_state.state = (
                ChannelPublishState.updated
                if version.is_published
                else ChannelPublishState.published
            )

            facebook_state = self._find_state(record.id, ChannelName.facebook)
            if not facebook_state:
                raise RuntimeError("Facebook channel state missing")
            fb_message = f"{version.title}\n\n{version.summary}"
            facebook_state.external_id = self.facebook.publish(fb_message)
            facebook_state.state = (
                ChannelPublishState.updated
                if version.is_published
                else ChannelPublishState.published
            )

            newsletter_state = self._find_state(record.id, ChannelName.newsletter)
            if not newsletter_state:
                raise RuntimeError("Newsletter channel state missing")
            if version.is_published:
                newsletter_state.state = ChannelPublishState.skipped
                newsletter_state.error_message = "No auto resend on updates"
            else:
                newsletter_state.external_id = self.mailgun.publish_newsletter(
                    version.title, f"<p>{version.summary}</p>"
                )
                newsletter_state.state = ChannelPublishState.published

            version.is_published = True
            topic.workflow_state = WorkflowState.published
            schedule.status = WorkflowState.published
            self.db.add_all(
                [
                    version,
                    topic,
                    schedule,
                    website_state,
                    facebook_state,
                    newsletter_state,
                ]
            )
            self.db.commit()
            self.telegram.send(
                f"Publicatie geslaagd voor topic {topic.id}: {version.title}"
            )
        except Exception as exc:
            schedule.status = WorkflowState.error
            topic.workflow_state = WorkflowState.error
            self.db.add(schedule)
            self.db.add(topic)
            self.db.add(
                RetryJob(
                    topic_id=topic.id,
                    flow_name="publish_schedule",
                    error_type=type(exc).__name__,
                    error_message=str(exc),
                    attempt=0,
                    max_attempts=5,
                    status=RetryStatus.queued,
                    next_run_at=datetime.now(UTC),
                )
            )
            self.db.commit()
            self.telegram.send(
                "\n".join(
                    [
                        "Publicatie fout",
                        f"topic: {topic.id}",
                        f"title: {version.title}",
                        f"error: {type(exc).__name__}",
                        f"message: {str(exc)}",
                    ]
                )
            )

    def retry_publish_for_topic(self, topic_id: str) -> bool:
        schedule = self._find_retryable_schedule(topic_id)
        if not schedule:
            return False
        if schedule.status == WorkflowState.scheduled and not self._claim_schedule(
            schedule.id
        ):
            return False
        if schedule.status == WorkflowState.error:
            schedule.status = WorkflowState.publishing
            self.db.add(schedule)
            self.db.commit()
        self._publish_schedule(schedule.id)
        return True

    def _find_retryable_schedule(self, topic_id: str) -> PublicationSchedule | None:
        return (
            self.db.query(PublicationSchedule)
            .filter(PublicationSchedule.topic_id == topic_id)
            .filter(
                PublicationSchedule.status.in_(
                    [WorkflowState.error, WorkflowState.scheduled]
                )
            )
            .order_by(PublicationSchedule.updated_at.desc())
            .first()
        )

    def _find_state(
        self, record_id: str, channel: ChannelName
    ) -> ChannelPublicationState | None:
        return (
            self.db.query(ChannelPublicationState)
            .filter(ChannelPublicationState.publication_record_id == record_id)
            .filter(ChannelPublicationState.channel == channel)
            .first()
        )

    def _claim_schedule(self, schedule_id: str) -> bool:
        now = datetime.now(UTC)
        result = self.db.execute(
            update(PublicationSchedule)
            .where(PublicationSchedule.id == schedule_id)
            .where(PublicationSchedule.status == WorkflowState.scheduled)
            .values(status=WorkflowState.publishing, updated_at=now)
            .execution_options(synchronize_session=False)
        )
        self.db.commit()
        return result.rowcount == 1
