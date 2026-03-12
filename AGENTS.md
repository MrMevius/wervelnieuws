# AGENTS Guide

This repository contains a production-ready v1 application for self-hosted communications automation for a Dutch local wind park project.

This file is the repo-local source of truth for agent behavior in this repository.

## Critical instruction

Do NOT rewrite, replace, or simplify this `AGENTS.md` unless the user explicitly asks for that.
You may propose additions, but do not overwrite project rules on your own.

## Mission

Build a maintainable, Dockerized application that allows a small internal communications team to:

- manage topics
- upload local source documents
- generate Dutch news content and illustrations with OpenAI
- review and edit generated output
- schedule publication
- publish to:
  - a custom website endpoint
  - Facebook Page via Graph API
  - Mailgun
- receive Telegram notifications
- maintain version history and audit trail

This is a real application, not a throwaway prototype.

## Fixed product decisions

These decisions are already made and must not be redesigned unless technically unavoidable.

### Architecture
- Backend: Python + FastAPI
- Frontend: React + TypeScript SPA
- Deployment: Docker Compose on self-hosted Ubuntu
- Storage model: hybrid
  - database for workflow, metadata, users, versions, logs, audit trail
  - local filesystem for uploads, generated assets, and exports
- Database: SQLite first, but architect for easy PostgreSQL migration later
- Auth: local username/password authentication
- Users: multiple admin users with equal permissions
- Background tasks: separate worker/scheduler container in the same codebase

### Workflow
- Human review is mandatory before publication
- Admins must be able to:
  - review article, summary, and illustration
  - edit article inline
  - edit summary inline
  - replace or regenerate illustration
  - approve or reject
  - schedule publication date/time
- Approval does not immediately publish
- Approval marks content ready; publishing happens at the scheduled date/time

### v1 publication channels
- Website: custom POST endpoint
- Facebook: Graph API
- Newsletter: Mailgun
- Notifications: Telegram only

### Website publish behavior
The application must send a payload containing:
- title
- slug
- article body
- summary
- image path or URL
- publication timestamp
- version number
- topic identifier
- update flag for revisions

The website handles rendering and placement.

### Source handling
- No Google Sheets
- No Google Drive
- Everything is handled locally in the app
- Source documents are uploaded through the dashboard
- Source documents are parsed and indexed locally
- Use a searchable local document-processing layer so generation uses relevant passages instead of raw full-file dumping

### AI rules
- Output language: Dutch
- Tone: informative, accessible, locally involved, calm, trustworthy
- Facts must come from uploaded source material and explicit per-topic notes
- AI may improve wording, structure, readability, and style
- AI may NOT introduce unsupported factual claims
- This rule is critical

### Illustration rules
- Use OpenAI for text and image generation in v1
- Illustration style: realistic and locally recognizable
- Avoid fantasy, activism, exaggeration, or misleading imagery
- Visuals should feel appropriate for local residents reading about a real infrastructure project

### Versioning rules
- Keep versions per topic
- Each regeneration or manual edit creates a new version
- Preserve history and allow rollback
- Track publication status per version
- Support website-aware update behavior

### Update behavior for published content
- Website: update existing published item
- Facebook: update existing post where possible
- Newsletter: do NOT resend automatically after edits

### Newsletter audience
- Mailgun mailing lists are the source of truth
- Do not build full newsletter-contact management in v1

## Preferred repository structure

The repo should evolve toward:

- `backend/`
- `frontend/`
- `worker/`
- `tests/`
- `.opencode/commands/`
- `docs/`

### Backend preferred layout
- `backend/app/api`
- `backend/app/core`
- `backend/app/models`
- `backend/app/schemas`
- `backend/app/services`
- `backend/app/repositories`
- `backend/app/integrations`
- `backend/app/workflows`
- `backend/app/tasks`

## Domain expectations

Use a clean domain model around entities such as:
- User
- Topic
- TopicSourceDocument
- TopicNote
- ContentVersion
- GeneratedImage
- PublicationSchedule
- PublicationRecord
- ChannelPublicationState
- AuditEvent
- NotificationEvent
- SystemSetting
- RetryJob / FailedJob

Use clean naming and strong separation of concerns.

## Workflow state model

Prefer explicit workflow states such as:
- draft
- planned
- generating
- review
- approved
- scheduled
- publishing
- published
- error

Track per-channel publication state separately.

## Document ingestion expectations

Support at least:
- PDF
- DOCX
- XLSX
- TXT
- Markdown

Implement:
- text extraction
- chunking
- metadata capture
- local indexing/search
- traceability to source passages where feasible

## UI expectations

The admin UI must support:
- topic overview with filters
- topic details
- source uploads
- generation actions
- inline article editing
- inline summary editing
- illustration preview/regeneration
- approval and scheduling
- version history
- per-channel publish status
- error and retry visibility

## Engineering rules

### Code quality
- Prefer readable, modular code
- Avoid god files
- Keep business logic out of transport layers
- Separate API/domain/persistence/integrations
- Add type hints consistently
- Add tests for critical flows
- Use structured logging
- Handle errors explicitly

### Security
- Never hardcode secrets
- Use environment variables
- Hash passwords
- Validate uploads and API input
- Avoid logging credentials, tokens, or secrets
- Sanitize uploaded content

### Integrations
Implement integrations behind adapter/service interfaces:
- OpenAI
- Website publisher
- Facebook publisher
- Mailgun sender
- Telegram notifier

### Testing
- Prefer targeted tests first for changed modules
- Then run broader suites when shared foundations are touched
- Add regression tests for bug fixes
- Keep unit tests deterministic
- Mock OpenAI, Facebook, Mailgun, and Telegram integrations in unit tests

## Working method for agents

When asked to build or modify this project:

1. Inspect the current codebase first
2. Restate the requested scope briefly
3. Propose the smallest sensible implementation plan
4. Implement in small logical steps
5. Keep migrations, tests, and docs updated
6. Do not redesign fixed choices unless necessary
7. If something is missing, scaffold it cleanly instead of improvising a messy shortcut

## Definition of done

A task is only done when:
- requested behavior is implemented
- critical path tests pass, or blockers are documented clearly
- lint/type checks pass for changed areas
- docs/config/examples are updated where relevant
- for each completed iteration, the website changelog (About page) is updated with a functional, end-user-friendly entry
- no secrets are exposed
- changes remain consistent with this `AGENTS.md`
