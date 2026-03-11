import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useMemo, useState } from "react";
import {
  addNote,
  approveTopic,
  channelStatus,
  createTopic,
  listAuditEvents,
  listDocuments,
  listNotes,
  listRetryJobs,
  listTopics,
  listVersions,
  login,
  manualEdit,
  rejectTopic,
  requeueRetryJob,
  rollbackVersion,
  scheduleTopic,
  triggerGeneration,
  uploadDocument
} from "../lib/api/client";

export function App() {
  const queryClient = useQueryClient();
  const [authenticated, setAuthenticated] = useState(false);
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);

  const topicsQuery = useQuery({ queryKey: ["topics"], queryFn: listTopics, enabled: authenticated });

  const selectedTopic = useMemo(
    () => topicsQuery.data?.find((t) => t.id === selectedTopicId) ?? null,
    [topicsQuery.data, selectedTopicId]
  );

  const notesQuery = useQuery({
    queryKey: ["notes", selectedTopicId],
    queryFn: () => listNotes(selectedTopicId!),
    enabled: Boolean(selectedTopicId)
  });

  const docsQuery = useQuery({
    queryKey: ["docs", selectedTopicId],
    queryFn: () => listDocuments(selectedTopicId!),
    enabled: Boolean(selectedTopicId)
  });

  const versionsQuery = useQuery({
    queryKey: ["versions", selectedTopicId],
    queryFn: () => listVersions(selectedTopicId!),
    enabled: Boolean(selectedTopicId)
  });

  const channelsQuery = useQuery({
    queryKey: ["channels", selectedTopicId],
    queryFn: () => channelStatus(selectedTopicId!),
    enabled: Boolean(selectedTopicId)
  });

  const retryQuery = useQuery({ queryKey: ["retry-jobs"], queryFn: listRetryJobs, enabled: authenticated });

  const auditQuery = useQuery({
    queryKey: ["audit", selectedTopicId],
    queryFn: () => listAuditEvents(selectedTopicId!),
    enabled: Boolean(selectedTopicId)
  });

  const loginMutation = useMutation({
    mutationFn: async (input: { username: string; password: string }) => login(input.username, input.password),
    onSuccess: () => setAuthenticated(true)
  });

  const topicMutation = useMutation({
    mutationFn: createTopic,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["topics"] })
  });

  const generateMutation = useMutation({
    mutationFn: triggerGeneration,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["topics"] });
      queryClient.invalidateQueries({ queryKey: ["versions", selectedTopicId] });
    }
  });

  const noteMutation = useMutation({
    mutationFn: (note: string) => addNote(selectedTopicId!, note),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notes", selectedTopicId] })
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadDocument(selectedTopicId!, file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["docs", selectedTopicId] })
  });

  const editMutation = useMutation({
    mutationFn: (payload: { title: string; slug: string; article_body: string; summary: string }) =>
      manualEdit(selectedTopicId!, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["versions", selectedTopicId] })
  });

  const actionMutation = useMutation({
    mutationFn: ({ type }: { type: "approve" | "reject" }) =>
      type === "approve" ? approveTopic(selectedTopicId!) : rejectTopic(selectedTopicId!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["topics"] })
  });

  const rollbackMutation = useMutation({
    mutationFn: (versionId: string) => rollbackVersion(selectedTopicId!, versionId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["versions", selectedTopicId] })
  });

  const scheduleMutation = useMutation({
    mutationFn: (publishAt: string) => scheduleTopic(selectedTopicId!, publishAt),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["topics"] })
  });

  const requeueMutation = useMutation({
    mutationFn: requeueRetryJob,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["retry-jobs"] })
  });

  if (!authenticated) {
    return (
      <main className="container">
        <h1>Wervelnieuws Dashboard</h1>
        <form className="card" onSubmit={(e) => handleLogin(e, loginMutation.mutate)}>
          <input name="username" placeholder="Gebruikersnaam" defaultValue="admin" />
          <input name="password" type="password" placeholder="Wachtwoord" defaultValue="admin12345" />
          <button type="submit">Inloggen</button>
        </form>
      </main>
    );
  }

  return (
    <main className="container wide">
      <header className="page-title">
        <h1>Wervelnieuws Dashboard</h1>
      </header>

      <section className="two-col">
        <div className="card">
          <h2>Nieuw topic</h2>
          <CreateTopicForm onSubmit={(payload) => topicMutation.mutate(payload)} />
        </div>

        <div className="card">
          <h2>Retry jobs</h2>
          {retryQuery.data?.map((job) => (
            <div key={job.id} className="list-item">
              <div>
                <strong>{job.flow_name}</strong>
                <p>{job.error_type}: {job.error_message}</p>
              </div>
              <button onClick={() => requeueMutation.mutate(job.id)}>Opnieuw plannen</button>
            </div>
          ))}
        </div>
      </section>

      <section className="layout">
        <div className="card">
          <h2>Topics</h2>
          {topicsQuery.isLoading && <p>Laden...</p>}
          {topicsQuery.data?.map((topic) => (
            <article className={`topic ${selectedTopicId === topic.id ? "active" : ""}`} key={topic.id}>
              <button className="topic-btn" onClick={() => setSelectedTopicId(topic.id)}>
                <strong>{topic.title}</strong>
                <span>{topic.subject}</span>
                <small>Status: {topic.workflow_state}</small>
              </button>
              <button onClick={() => generateMutation.mutate(topic.id)}>Genereer</button>
            </article>
          ))}
        </div>

        <div className="card">
          <h2>Review</h2>
          {!selectedTopic && <p>Kies eerst een topic.</p>}
          {selectedTopic && (
            <>
              <p><strong>{selectedTopic.title}</strong> - {selectedTopic.theme}</p>
              <div className="row">
                <button onClick={() => actionMutation.mutate({ type: "approve" })}>Approve</button>
                <button onClick={() => actionMutation.mutate({ type: "reject" })}>Reject</button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  const publishAt = String(fd.get("publish_at") ?? "");
                  if (publishAt) scheduleMutation.mutate(new Date(publishAt).toISOString());
                }}
              >
                <label>Publicatiemoment</label>
                <input type="datetime-local" name="publish_at" />
                <button type="submit">Inplannen</button>
              </form>

              <h3>Bronnen</h3>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const fileInput = e.currentTarget.elements.namedItem("file") as HTMLInputElement;
                  const file = fileInput.files?.[0];
                  if (file) uploadMutation.mutate(file);
                }}
              >
                <input name="file" type="file" />
                <button type="submit">Upload</button>
              </form>
              {docsQuery.data?.map((doc) => (
                <p key={doc.id}>{doc.filename} - {doc.status}</p>
              ))}

              <h3>Notities</h3>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  const note = String(fd.get("note") ?? "").trim();
                  if (note) noteMutation.mutate(note);
                  e.currentTarget.reset();
                }}
              >
                <textarea name="note" rows={2} placeholder="Voeg notitie toe" />
                <button type="submit">Toevoegen</button>
              </form>
              {notesQuery.data?.map((note) => (
                <p key={note.id}>{note.note}</p>
              ))}

              <h3>Versies</h3>
              <VersionEditor
                onSave={(payload) => editMutation.mutate(payload)}
                current={versionsQuery.data?.find((v) => v.is_current)}
              />
              {versionsQuery.data?.map((version) => (
                <div className="list-item" key={version.id}>
                  <div>
                    <strong>v{version.version_number}</strong>
                    <p>{version.title}</p>
                  </div>
                  <button onClick={() => rollbackMutation.mutate(version.id)}>Rollback</button>
                </div>
              ))}

              <h3>Kanaalstatus</h3>
              {channelsQuery.data?.map((row) => (
                <div key={`${row.channel}-${row.updated_at}`} className="list-item">
                  <div>
                    <strong>{row.channel}</strong>
                    <p>status: {row.state}</p>
                    {row.external_id && <p>external id: {row.external_id}</p>}
                    {row.error_message && <p>error: {row.error_message}</p>}
                  </div>
                  <small>{new Date(row.updated_at).toLocaleString()}</small>
                </div>
              ))}

              <h3>Audit trail</h3>
              {auditQuery.data?.map((event) => (
                <div className="list-item" key={event.id}>
                  <div>
                    <strong>{event.event_type}</strong>
                    <p>{event.details_json}</p>
                  </div>
                  <small>{new Date(event.created_at).toLocaleString()}</small>
                </div>
              ))}
            </>
          )}
        </div>
      </section>
    </main>
  );
}

function handleLogin(
  e: FormEvent<HTMLFormElement>,
  submit: (input: { username: string; password: string }) => void
) {
  e.preventDefault();
  const data = new FormData(e.currentTarget);
  submit({
    username: String(data.get("username") ?? ""),
    password: String(data.get("password") ?? "")
  });
}

function CreateTopicForm({
  onSubmit
}: {
  onSubmit: (payload: { title: string; subject: string; theme: string; editorial_notes: string; planning_at: string | null }) => void;
}) {
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    onSubmit({
      title: String(fd.get("title") ?? ""),
      subject: String(fd.get("subject") ?? ""),
      theme: String(fd.get("theme") ?? ""),
      editorial_notes: String(fd.get("editorial_notes") ?? ""),
      planning_at: null
    });
    e.currentTarget.reset();
  }

  return (
    <form onSubmit={submit}>
      <input name="title" placeholder="Titel" required />
      <input name="subject" placeholder="Onderwerp" required />
      <input name="theme" placeholder="Thema" required />
      <textarea name="editorial_notes" placeholder="Redactionele notities" rows={3} />
      <button type="submit">Topic aanmaken</button>
    </form>
  );
}

function VersionEditor({
  current,
  onSave
}: {
  current:
    | {
        title: string;
        slug: string;
        article_body: string;
        summary: string;
      }
    | undefined;
  onSave: (payload: { title: string; slug: string; article_body: string; summary: string }) => void;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        onSave({
          title: String(fd.get("title") ?? ""),
          slug: String(fd.get("slug") ?? ""),
          article_body: String(fd.get("article_body") ?? ""),
          summary: String(fd.get("summary") ?? "")
        });
      }}
    >
      <input name="title" defaultValue={current?.title ?? ""} placeholder="Titel" />
      <input name="slug" defaultValue={current?.slug ?? ""} placeholder="Slug" />
      <textarea name="article_body" defaultValue={current?.article_body ?? ""} rows={6} placeholder="Artikel" />
      <textarea name="summary" defaultValue={current?.summary ?? ""} rows={3} placeholder="Samenvatting" />
      <button type="submit">Nieuwe versie opslaan</button>
    </form>
  );
}
