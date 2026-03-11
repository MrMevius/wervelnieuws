const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api";

export type Topic = {
  id: string;
  title: string;
  subject: string;
  theme: string;
  editorial_notes: string;
  planning_at: string | null;
  workflow_state: string;
  is_archived: boolean;
};

export type Note = { id: string; note: string };
export type SourceDocument = {
  id: string;
  filename: string;
  doc_type: string;
  status: string;
  extraction_error: string;
};

export type ContentVersion = {
  id: string;
  topic_id: string;
  version_number: number;
  title: string;
  slug: string;
  article_body: string;
  summary: string;
  source_trace_json: string;
  generated_image_id: string | null;
  is_current: boolean;
  is_published: boolean;
  created_at: string;
};

export type ChannelStatus = {
  channel: string;
  state: string;
  external_id: string;
  error_message: string;
  created_at: string;
  updated_at: string;
};

export type AuditEvent = {
  id: string;
  topic_id: string | null;
  actor_user_id: string | null;
  event_type: string;
  details_json: string;
  created_at: string;
};

export type RetryJob = {
  id: string;
  topic_id: string;
  flow_name: string;
  error_type: string;
  error_message: string;
  attempt: number;
  max_attempts: number;
  status: string;
  next_run_at: string;
};

let token = "";

export function setToken(value: string) {
  token = value;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const isFormData = init?.body instanceof FormData;
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {})
    }
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return res.json() as Promise<T>;
}

export async function login(username: string, password: string) {
  const result = await request<{ access_token: string }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password })
  });
  setToken(result.access_token);
}

export function listTopics() {
  return request<Topic[]>("/topics");
}

export function createTopic(payload: Omit<Topic, "id" | "workflow_state" | "is_archived">) {
  return request<Topic>("/topics", { method: "POST", body: JSON.stringify(payload) });
}

export function triggerGeneration(topicId: string) {
  return request<{ version_id: string }>(`/content/${topicId}/generate`, { method: "POST" });
}

export function listNotes(topicId: string) {
  return request<Note[]>(`/topics/${topicId}/notes`);
}

export function addNote(topicId: string, note: string) {
  return request<Note>(`/topics/${topicId}/notes`, {
    method: "POST",
    body: JSON.stringify({ note })
  });
}

export function listDocuments(topicId: string) {
  return request<SourceDocument[]>(`/topics/${topicId}/documents`);
}

export function uploadDocument(topicId: string, file: File) {
  const fd = new FormData();
  fd.append("file", file);
  return request<SourceDocument>(`/topics/${topicId}/documents`, {
    method: "POST",
    body: fd
  });
}

export function listVersions(topicId: string) {
  return request<ContentVersion[]>(`/content/${topicId}/versions`);
}

export function manualEdit(topicId: string, payload: Pick<ContentVersion, "title" | "slug" | "article_body" | "summary">) {
  return request<ContentVersion>(`/content/${topicId}/manual-edit`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function rollbackVersion(topicId: string, versionId: string) {
  return request<{ status: string }>(`/content/${topicId}/rollback/${versionId}`, { method: "POST" });
}

export function approveTopic(topicId: string) {
  return request<{ status: string }>(`/content/${topicId}/approve`, { method: "POST" });
}

export function rejectTopic(topicId: string) {
  return request<{ status: string }>(`/content/${topicId}/reject`, { method: "POST" });
}

export function scheduleTopic(topicId: string, publishAt: string) {
  return request<{ schedule_id: string }>(`/content/${topicId}/schedule`, {
    method: "POST",
    body: JSON.stringify({ publish_at: publishAt })
  });
}

export function channelStatus(topicId: string) {
  return request<ChannelStatus[]>(`/content/${topicId}/channel-status`);
}

export function listRetryJobs() {
  return request<RetryJob[]>("/content/retry-jobs");
}

export function requeueRetryJob(jobId: string) {
  return request<{ status: string }>(`/content/retry-jobs/${jobId}/requeue`, { method: "POST" });
}

export function listAuditEvents(topicId: string) {
  return request<AuditEvent[]>(`/topics/${topicId}/audit-events`);
}
