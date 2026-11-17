# Meeting-card recordings

The browser records audio in memory and uploads the complete file after Stop.
Keep the page open until upload has completed. The upload carries a random UUID
that is retained for a retry; uniqueness is enforced per uploader in the database.
Repeating an upload with that ID returns the same recording. Reusing it on a
different card is rejected. An upload failure retains the audio in the current
page for an explicit retry; reloading before a successful upload loses that copy.

New clients request server processing on upload. The existing worker picks up
one queued recording after publication/retry work in each cycle and performs transcription, summarization
and posting without further browser requests. The open card polls every 1.5
seconds while processing is active. Reopening a card shows persisted progress.

Processing states are `queued`, `transcribing`, `summarizing`, `posting`, `done`
and `failed`. Failures expose only the step name, never provider error details.
The saved audio remains playable; successful transcription and summary results
are retained. Retry queues a failed job and resumes from its completed steps.
Completed jobs are not requeued, so retries never overwrite manual edits or
resurrect deleted updates. Hidden, archived or deleted targets and inactive or
unauthorized uploaders are not used to create new activity.

Each recording uses a conditional database claim with a random owner token and
a ten-minute lease renewed before each processing step. External requests have
a 120-second SDK timeout and at most one SDK retry. A live claim excludes another
worker; an expired claim permits recovery after a worker restart. All result
writes check token ownership and lease expiry. The update, audit entry and
completed state commit in one transaction. Browser posting/transcribing endpoints
reject managed recordings so they cannot race the worker.

A worker crash after an external provider has answered but before its result is
saved, or an unusually slow request that outlives its lease, may cause that
external request to be repeated after lease expiry. This
is not an exactly-once guarantee for provider billing; persisted results are
reused and the card update is committed only once. Failed jobs await an explicit
retry rather than repeatedly calling the provider. There is no automatic job
conversion for historical recordings.

Summaries use the configured text model with the transcript and bounded card/
board context. The prompt requires facts from the transcript only and one bullet
per relevant point, with length suited to the content and no fixed bullet cap.
The full transcript remains attached to the recording; editing the update changes
the summary, not the original transcript. Processing never publishes to external
news channels.

For schema requirements and production recovery, see
[Release readiness](release-readiness.md#durable-meeting-card-recording-processing-november-2026).
