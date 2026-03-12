const configuredApiBase = import.meta.env.VITE_API_BASE_URL?.trim();

function resolveApiBase(): string {
  const fallback = `${window.location.protocol}//${window.location.hostname}:8001/api`;
  if (!configuredApiBase) {
    return fallback;
  }

  try {
    const url = new URL(configuredApiBase);
    const isConfiguredLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    const currentHost = window.location.hostname;
    const isCurrentLocal = currentHost === "localhost" || currentHost === "127.0.0.1";
    if (isConfiguredLocal && !isCurrentLocal) {
      url.hostname = currentHost;
      return url.toString().replace(/\/$/, "");
    }
    return configuredApiBase.replace(/\/$/, "");
  } catch {
    return configuredApiBase.replace(/\/$/, "");
  }
}

const API_BASE = resolveApiBase();

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
  source_trace: SourceTraceHit[];
  generated_image_id: string | null;
  is_current: boolean;
  is_published: boolean;
  created_at: string;
};

export type SourceTraceHit = {
  source: string;
  source_type: string;
  chunk_id: string;
  chunk_index: string;
  text: string;
  document_id: string;
  document_name: string;
  topic_id: string;
  project_id: string;
  project_name: string;
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

export type CurrentUser = {
  id: string;
  username: string;
  full_name: string | null;
  email: string | null;
  is_admin: boolean;
  theme_preference: "light" | "dark" | "system";
  has_avatar: boolean;
};

export type AdminUser = {
  id: string;
  username: string;
  full_name: string | null;
  email: string | null;
  is_admin: boolean;
  is_active: boolean;
};

export type Project = {
  id: string;
  name: string;
  is_active: boolean;
};

export type DatabaseDocument = {
  id: string;
  filename: string;
  doc_type: string;
  status: string;
  extraction_error: string;
  size_bytes: number;
  project_id: string;
  project_name: string;
  uploaded_by_user_id: string;
  uploaded_by_username: string;
  created_at: string;
};

export type UploadProgressCallback = (progress: number) => void;

export type UpdateCurrentUserPayload = {
  full_name: string | null;
  email: string | null;
  theme_preference: "light" | "dark" | "system";
};

export type ChangePasswordPayload = {
  current_password: string;
  new_password: string;
};

export type ChangelogEntry = {
  iteration: string;
  date: string;
  title: string;
  highlights: string[];
};

export type AboutContent = {
  description: string;
  disclaimer: string;
  developed_by: string;
  changelog: ChangelogEntry[];
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

async function requestBlob(path: string, init?: RequestInit): Promise<Blob> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {})
    }
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return res.blob();
}

export async function login(username: string, password: string) {
  const result = await request<{ access_token: string }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password })
  });
  setToken(result.access_token);
}

export function getCurrentUser() {
  return request<CurrentUser>("/auth/me");
}

export function updateCurrentUser(payload: UpdateCurrentUserPayload) {
  return request<CurrentUser>("/auth/me", {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function changeCurrentUserPassword(payload: ChangePasswordPayload) {
  return request<{ status: string }>("/auth/me/password", {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function uploadCurrentUserAvatar(file: Blob) {
  const fd = new FormData();
  fd.append("file", file, "avatar.png");
  return request<CurrentUser>("/auth/me/avatar", {
    method: "POST",
    body: fd
  });
}

export function getCurrentUserAvatarBlob() {
  return requestBlob("/auth/me/avatar");
}

export function getAboutContent() {
  return request<AboutContent>("/meta/about");
}

export function listAdminUsers() {
  return request<AdminUser[]>("/admin/users");
}

export function createAdminUser(username: string, password: string) {
  return request<AdminUser>("/admin/users", {
    method: "POST",
    body: JSON.stringify({ username, password })
  });
}

export function updateAdminUser(userId: string, is_admin: boolean) {
  return request<AdminUser>(`/admin/users/${userId}`, {
    method: "PATCH",
    body: JSON.stringify({ is_admin })
  });
}

export function changeAdminUserPassword(userId: string, new_password: string) {
  return request<{ status: string }>(`/admin/users/${userId}/password`, {
    method: "PATCH",
    body: JSON.stringify({ new_password })
  });
}

export function updateAdminUserActive(userId: string, is_active: boolean) {
  return request<AdminUser>(`/admin/users/${userId}/active`, {
    method: "PATCH",
    body: JSON.stringify({ is_active })
  });
}

export function deleteAdminUser(userId: string) {
  return request<{ status: string }>(`/admin/users/${userId}`, {
    method: "DELETE"
  });
}

export function listAdminProjects() {
  return request<Project[]>("/admin/projects");
}

export function createAdminProject(name: string) {
  return request<Project>("/admin/projects", {
    method: "POST",
    body: JSON.stringify({ name })
  });
}

export function updateAdminProject(projectId: string, payload: { name?: string; is_active?: boolean }) {
  return request<Project>(`/admin/projects/${projectId}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function listDatabaseProjects() {
  return request<Project[]>("/database/projects");
}

export function listDatabaseDocuments(projectId?: string) {
  const suffix = projectId ? `?project_id=${encodeURIComponent(projectId)}` : "";
  return request<DatabaseDocument[]>(`/database/documents${suffix}`);
}

export function uploadDatabaseDocument(projectId: string, file: File) {
  const fd = new FormData();
  fd.append("project_id", projectId);
  fd.append("file", file);
  return request<DatabaseDocument>("/database/documents", {
    method: "POST",
    body: fd
  });
}

export function uploadDatabaseDocumentWithProgress(
  projectId: string,
  file: File,
  onProgress: UploadProgressCallback
) {
  const fd = new FormData();
  fd.append("project_id", projectId);
  fd.append("file", file);
  return new Promise<DatabaseDocument>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE}/database/documents`);
    if (token) {
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    }

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || event.total === 0) {
        return;
      }
      const pct = Math.min(100, Math.round((event.loaded / event.total) * 100));
      onProgress(pct);
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const parsed = JSON.parse(xhr.responseText) as DatabaseDocument;
          onProgress(100);
          resolve(parsed);
        } catch {
          reject(new Error("Invalid upload response"));
        }
        return;
      }
      reject(new Error(xhr.responseText || "Upload failed"));
    };

    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(fd);
  });
}

export function deleteDatabaseDocument(documentId: string) {
  return request<{ status: string }>(`/database/documents/${documentId}`, {
    method: "DELETE"
  });
}

export function bulkDeleteDatabaseDocuments(documentIds: string[]) {
  return request<{ status: string; affected: number }>("/database/documents/bulk/delete", {
    method: "POST",
    body: JSON.stringify({ document_ids: documentIds })
  });
}

export function bulkMoveDatabaseDocuments(documentIds: string[], targetProjectId: string) {
  return request<{ status: string; affected: number }>("/database/documents/bulk/move", {
    method: "POST",
    body: JSON.stringify({ document_ids: documentIds, target_project_id: targetProjectId })
  });
}

export function bulkCopyDatabaseDocuments(documentIds: string[], targetProjectId: string) {
  return request<{ status: string; affected: number }>("/database/documents/bulk/copy", {
    method: "POST",
    body: JSON.stringify({ document_ids: documentIds, target_project_id: targetProjectId })
  });
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
