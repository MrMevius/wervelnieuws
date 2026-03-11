# Architecture Overview

## Services

- `backend`: FastAPI API handling auth, topics, ingestion, generation, review, scheduling APIs.
- `worker`: scheduler loop handling due publication jobs and retry queue processing.
- `frontend`: React SPA dashboard for editorial operations.

## Domain model

Core entities:
- User
- Topic
- TopicSourceDocument
- DocumentChunk (with SQLite FTS index)
- TopicNote
- ContentVersion
- GeneratedImage
- PublicationSchedule
- PublicationRecord
- ChannelPublicationState
- AuditEvent
- NotificationEvent
- SystemSetting
- RetryJob

## Publication adapters

Isolated integration clients:
- OpenAI (text + image generation)
- Website publisher
- Facebook publisher
- Mailgun sender
- Telegram notifier

## Reliability and safety

- Retry jobs are persisted and executed by flow (`publish_schedule`) with backoff.
- Login and document upload routes include basic rate limiting.
- Upload handling enforces size limits and content type checks.

## Storage

- SQLite DB file in mounted `/data` volume
- Uploaded source files under `/data/uploads/<topic-id>/`
- Generated images under `/data/generated/`
- Export artifacts under `/data/exports/`
