from enum import Enum


class WorkflowState(str, Enum):
    draft = "draft"
    planned = "planned"
    generating = "generating"
    review = "review"
    approved = "approved"
    scheduled = "scheduled"
    publishing = "publishing"
    published = "published"
    rejected = "rejected"
    error = "error"


class ChannelName(str, Enum):
    website = "website"
    facebook = "facebook"
    newsletter = "newsletter"


class ChannelPublishState(str, Enum):
    pending = "pending"
    scheduled = "scheduled"
    publishing = "publishing"
    published = "published"
    updated = "updated"
    failed = "failed"
    retrying = "retrying"
    skipped = "skipped"


class ContentApprovalState(str, Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class DocumentType(str, Enum):
    pdf = "pdf"
    docx = "docx"
    xlsx = "xlsx"
    txt = "txt"
    markdown = "markdown"
    audio = "audio"


class AudioTranscriptionStatus(str, Enum):
    not_applicable = "not_applicable"
    queued = "queued"
    transcribing = "transcribing"
    completed = "completed"
    failed = "failed"


class DocumentStatus(str, Enum):
    uploaded = "uploaded"
    parsing = "parsing"
    indexed = "indexed"
    failed = "failed"


class RetryStatus(str, Enum):
    queued = "queued"
    in_progress = "in_progress"
    failed = "failed"
    resolved = "resolved"


class ThemePreference(str, Enum):
    light = "light"
    dark = "dark"
    system = "system"


class BoardColumn(str, Enum):
    todo = "todo"
    doing = "doing"
    done = "done"
