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
      if (window.location.protocol === "https:") {
        return `${window.location.origin}/api`;
      }
      url.protocol = window.location.protocol;
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
  project_id: string;
  project_name: string;
  editorial_notes: string;
  text_feedback?: string;
  image_feedback?: string;
  planning_at: string | null;
  workflow_state: string;
  is_archived: boolean;
  target_channels: string[];
};

export type TopicImportResult = {
  created: number;
  failed: number;
  errors: Array<{ line: number; error: string }>;
};

export type Note = { id: string; note: string };
export type SourceDocument = {
  id: string;
  filename: string;
  parent_source_document_id: string | null;
  doc_type: string;
  status: string;
  duration_seconds: number | null;
  transcription_status: string;
  transcription_attempts: number;
  extraction_error: string;
  transcription_error: string;
  transcription_text: string;
  transcription_model: string;
  transcription_language: string;
  speaker_labels_json: string;
  transcript_document_id: string | null;
  created_at: string;
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

export type ContentChannelVariant = {
  id: string;
  content_version_id: string;
  topic_id: string;
  channel: "website" | "facebook" | "newsletter";
  title: string;
  article_body: string;
  summary: string;
  generated_image_id: string | null;
  generated_image_path: string | null;
  approval_state: "pending" | "approved" | "rejected";
  text_approval_state?: "pending" | "approved" | "rejected";
  image_approval_state?: "pending" | "approved" | "rejected";
  approved_by_user_id: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
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
  relevance_score?: number | null;
};

export type ChannelStatus = {
  channel: string;
  state: string;
  external_id: string;
  error_message: string;
  created_at: string;
  updated_at: string;
};

export type CurrentSchedule = {
  schedule_id: string;
  topic_id: string;
  content_version_id: string;
  scheduled_for: string;
  status: string;
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

export type SchedulerRecentRun = {
  schedule_id: string;
  topic_id: string;
  topic_subject: string;
  content_version_id: string;
  scheduled_for: string;
  status: string;
  updated_at: string;
};

export type SchedulerUpcomingRun = {
  schedule_id: string;
  topic_id: string;
  topic_subject: string;
  content_version_id: string;
  scheduled_for: string;
  status: string;
};

export type SchedulerRetryJob = {
  id: string;
  topic_id: string;
  topic_subject: string;
  flow_name: string;
  status: string;
  attempt: number;
  max_attempts: number;
  next_run_at: string;
  error_type: string;
  error_message: string;
};

export type SchedulerOverview = {
  generated_at: string;
  recent_runs: SchedulerRecentRun[];
  upcoming_runs: SchedulerUpcomingRun[];
  retry_jobs: SchedulerRetryJob[];
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
  has_avatar?: boolean;
  avatar_url?: string | null;
};

export type UpdateAdminUserProfilePayload = {
  full_name: string | null;
  email: string | null;
};

export type Project = {
  id: string;
  name: string;
  is_active: boolean;
};

export type BoardProjectSummary = {
  id: string;
  name: string;
  description: string;
  invited_user_ids: string[];
  card_count: number;
  last_activity_at: string | null;
};

export type BoardRightsUser = AdminUser;

export type BoardRightsOverview = {
  users: BoardRightsUser[];
  projects: BoardProjectSummary[];
};

export type BoardCard = {
  id: string;
  project_id: string;
  title: string;
  description: string;
  column: "todo" | "doing" | "done";
  position: number;
  is_archived?: boolean;
  assignments: Array<{ id: string; user_id: string; username: string; user_display_name: string; has_avatar?: boolean; avatar_url?: string | null }>;
  updates_count: number;
  recordings_count: number;
  attachments_count: number;
};

export type BoardAccessUser = {
  id: string;
  username: string;
  full_name: string | null;
  is_admin: boolean;
  is_active: boolean;
  has_avatar?: boolean;
};

export type BoardProjectDetail = {
  project_id: string;
  project_name: string;
  invited_user_ids: string[];
  access_users: BoardAccessUser[];
  cards: BoardCard[];
  archived_cards: BoardCard[];
};

export type BoardRecycleBinCard = BoardCard & {
  project_name: string;
  deleted_at: string;
  deleted_by_user_id: string | null;
  deleted_by_username: string | null;
  deleted_by_display_name: string | null;
};

export type BoardCardDetail = {
  card: BoardCard;
  updates: Array<{ id: string; author_user_id: string; author_username: string; author_display_name: string; message: string; image_url: string | null; edited_from_update_id: string | null; created_at: string }>;
  recordings: Array<{
    id: string;
    uploaded_by_user_id?: string | null;
    uploaded_by_username?: string | null;
    uploaded_by_display_name?: string | null;
    filename: string;
    file_path: string;
    duration?: number | null;
    recorded_at: string;
    transcription_status: "pending" | "done" | "failed";
    transcription_text: string;
    mime_type: string;
    size_bytes?: number | null;
    created_at: string;
    download_url: string;
  }>;
  attachments: Array<{
    id: string;
    uploaded_by_user_id: string;
    uploaded_by_username?: string | null;
    uploaded_by_display_name?: string | null;
    filename: string;
    mime_type: string;
    size_bytes: number;
    created_at: string;
    download_url: string;
  }>;
};

export type AdminTheme = {
  id: string;
  name: string;
  is_active: boolean;
};

export type TopicThemeOption = {
  id: string;
  name: string;
};

export type AdminScheduleTemplate = {
  id: string;
  label: string;
  subject_template: string;
  theme: string;
  editorial_notes: string;
  planning_time: string;
};

export type AdminActivity = {
  id: string;
  event_type: string;
  topic_id: string | null;
  topic_subject: string | null;
  actor_user_id: string | null;
  actor_username: string;
  created_at: string;
};

export type ActivityFeedItem = {
  id: string;
  event_type: string;
  topic_id: string | null;
  topic_subject: string | null;
  actor_user_id: string | null;
  actor_username: string;
  details_json: string;
  created_at: string;
};

export type NotificationFeedItem = {
  id: string;
  event_type: string;
  status: "success" | "error";
  topic_id: string | null;
  topic_subject: string | null;
  message: string;
  payload_json: string;
  delivery_attempts: number;
  delivered_at: string | null;
  last_error: string;
  created_at: string;
};

export type ActivityFeedFilters = {
  event_type?: string;
  topic?: string;
  period?: "24h" | "7d" | "30d" | "all";
  limit?: number;
};

export type NotificationFeedFilters = {
  event_type?: string;
  status?: "success" | "error";
  topic?: string;
  period?: "24h" | "7d" | "30d" | "all";
  limit?: number;
};

export type GenAIConfig = {
  system_prompt: string;
  website_prompt: string;
  facebook_prompt: string;
  newsletter_prompt: string;
  text_model: string;
  image_model: string;
  whisper_model: string;
  whisper_language: string;
  websearch_enabled: boolean;
  websearch_max_results: number;
  has_api_key: boolean;
};

export type GenAIModelOptions = {
  text_models: string[];
  image_models: string[];
};

export type UpdateGenAIConfigPayload = Partial<{
  system_prompt: string;
  website_prompt: string;
  facebook_prompt: string;
  newsletter_prompt: string;
  text_model: string;
  image_model: string;
  whisper_model: string;
  whisper_language: string;
  websearch_enabled: boolean;
  websearch_max_results: number;
  openai_api_key: string;
}>;

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

export type UiSettings = {
  wind_theme_enabled: boolean;
};

let token = "";

export function setToken(value: string) {
  token = value;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const isFormData = init?.body instanceof FormData;
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: "include",
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
    credentials: "include",
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

export async function login(username: string, password: string, rememberMe = false) {
  await request<{ access_token: string }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password, remember_me: rememberMe })
  });
}

export function logout() {
  return request<{ status: string }>("/auth/logout", {
    method: "POST"
  });
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

export function getUiSettings() {
  return request<UiSettings>("/meta/ui-settings");
}

export function listAdminUsers() {
  return request<AdminUser[]>("/admin/users");
}

export function getAdminUserAvatarUrl(userId: string) {
  return `${API_BASE}/admin/users/${encodeURIComponent(userId)}/avatar`;
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

export function updateAdminUserProfile(userId: string, payload: UpdateAdminUserProfilePayload) {
  return request<AdminUser>(`/admin/users/${userId}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function uploadAdminUserAvatar(userId: string, file: Blob) {
  const fd = new FormData();
  fd.append("file", file, "avatar.png");
  return request<AdminUser>(`/admin/users/${userId}/avatar`, {
    method: "POST",
    body: fd
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

export function listBoardProjects() {
  return request<BoardProjectSummary[]>("/boards/projects");
}

export function createBoardProject(payload: { name: string; description: string; invited_user_ids: string[] }) {
  return request<BoardProjectSummary>("/boards/projects", { method: "POST", body: JSON.stringify(payload) });
}

export function listBoardRights() {
  return request<BoardRightsOverview>("/boards/admin/rights");
}

export function updateBoardRights(projectId: string, payload: { invited_user_ids: string[] }) {
  return request<BoardProjectSummary>(`/boards/admin/projects/${projectId}/rights`, { method: "PATCH", body: JSON.stringify(payload) });
}

export function archiveBoardProject(projectId: string) {
  return request<BoardProjectSummary>(`/boards/admin/projects/${projectId}`, { method: "DELETE" });
}

export function getBoardProject(projectId: string) {
  return request<BoardProjectDetail>(`/boards/projects/${projectId}`);
}

export function createBoardCard(projectId: string, payload: { title: string; description: string; column: "todo" | "doing" | "done"; assignment_user_ids: string[] }) {
  return request<BoardCard>(`/boards/projects/${projectId}/cards`, { method: "POST", body: JSON.stringify(payload) });
}

export function archiveBoardCard(cardId: string) {
  return request<BoardCard>(`/boards/cards/${cardId}/archive`, { method: "PATCH" });
}

export function restoreBoardCard(cardId: string) {
  return request<BoardCard>(`/boards/cards/${cardId}/restore`, { method: "PATCH" });
}

export function deleteBoardCard(cardId: string) {
  return request<{ status: string }>(`/boards/cards/${cardId}`, { method: "DELETE" });
}

export function listBoardRecycleBin() {
  return request<BoardRecycleBinCard[]>("/boards/admin/recycle-bin");
}

export function restoreDeletedBoardCard(cardId: string) {
  return request<BoardCard>(`/boards/admin/recycle-bin/${cardId}/restore`, { method: "PATCH" });
}

export function moveBoardCard(cardId: string, payload: { column: "todo" | "doing" | "done"; position: number }) {
  return request<BoardCard>(`/boards/cards/${cardId}/move`, { method: "PATCH", body: JSON.stringify(payload) });
}

export function updateBoardCardTitle(cardId: string, payload: { title: string }) {
  return request<BoardCard>(`/boards/cards/${cardId}/title`, { method: "PATCH", body: JSON.stringify(payload) });
}

export function updateBoardCardDescription(cardId: string, payload: { description: string }) {
  return request<BoardCard>(`/boards/cards/${cardId}/description`, { method: "PATCH", body: JSON.stringify(payload) });
}

export function getBoardCard(cardId: string) {
  return request<BoardCardDetail>(`/boards/cards/${cardId}`);
}

export function postBoardCardUpdate(cardId: string, message: string) {
  return request<{ id: string }>(`/boards/cards/${cardId}/updates`, { method: "POST", body: JSON.stringify({ message }) });
}

export function editBoardCardUpdate(cardId: string, updateId: string, payload: { message: string; remove_image?: boolean; image?: Blob | null }) {
  const fd = new FormData();
  fd.append("message", payload.message);
  if (payload.remove_image) fd.append("remove_image", "true");
  if (payload.image) fd.append("image", payload.image, "update-image.png");
  return request<{ id: string }>(`/boards/cards/${cardId}/updates/${updateId}`, { method: "PATCH", body: fd });
}

export function deleteBoardCardUpdate(cardId: string, updateId: string) {
  return request<{ status: string }>(`/boards/cards/${cardId}/updates/${updateId}`, { method: "DELETE" });
}

export function uploadBoardRecording(cardId: string, blob: Blob, duration?: number) {
  const fd = new FormData();
  fd.append("file", blob, "opname.webm");
  if (typeof duration === "number" && Number.isFinite(duration) && duration > 0) {
    fd.append("duration", String(Math.round(duration)));
  }
  return request<{ id: string }>(`/boards/cards/${cardId}/recordings`, { method: "POST", body: fd });
}

export function uploadBoardCardAttachment(cardId: string, file: File) {
  const fd = new FormData();
  fd.append("file", file, file.name || "bijlage");
  return request<{ id: string }>(`/boards/cards/${cardId}/attachments`, { method: "POST", body: fd });
}

export function deleteBoardCardAttachment(cardId: string, attachmentId: string) {
  return request<{ status: string }>(`/boards/cards/${cardId}/attachments/${attachmentId}`, { method: "DELETE" });
}

export function getAdminGenAIConfig() {
  return request<GenAIConfig>("/admin/genai-config");
}

export function getAdminGenAIModelOptions() {
  return request<GenAIModelOptions>("/admin/genai-model-options");
}

export function getAdminUiSettings() {
  return request<UiSettings>("/admin/ui-settings");
}

export function updateAdminUiSettings(payload: UiSettings) {
  return request<UiSettings>("/admin/ui-settings", {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function updateAdminGenAIConfig(payload: UpdateGenAIConfigPayload) {
  return request<GenAIConfig>("/admin/genai-config", {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function listTopicDocuments(topicId: string) {
  return request<SourceDocument[]>(`/topics/${topicId}/documents`);
}

export function uploadTopicDocument(topicId: string, file: File, durationSeconds?: number) {
  const fd = new FormData();
  fd.append("file", file);
  if (typeof durationSeconds === "number") {
    fd.append("duration_seconds", String(durationSeconds));
  }
  return request<SourceDocument>(`/topics/${topicId}/documents`, {
    method: "POST",
    body: fd
  });
}

export function retryTopicDocumentTranscription(topicId: string, documentId: string) {
  return request<SourceDocument>(`/topics/${topicId}/documents/${documentId}/retry-transcription`, {
    method: "POST"
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
    xhr.withCredentials = true;
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

export function listTopicThemes() {
  return request<TopicThemeOption[]>("/topics/themes");
}

export function listTopicScheduleTemplates() {
  return request<AdminScheduleTemplate[]>("/topics/schedule-templates");
}

export type CreateTopicPayload = {
  title: string;
  subject: string;
  theme: string;
  project_id: string;
  editorial_notes: string;
  text_feedback?: string;
  image_feedback?: string;
  planning_at: string | null;
  target_channels: string[];
};

export function createTopic(payload: CreateTopicPayload) {
  return request<Topic>("/topics", { method: "POST", body: JSON.stringify(payload) });
}

export function updateTopic(topicId: string, payload: Partial<CreateTopicPayload> & { workflow_state?: string }) {
  return request<Topic>(`/topics/${topicId}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function deleteTopic(topicId: string) {
  return request<{ status: string }>(`/topics/${topicId}`, { method: "DELETE" });
}

export function importTopicsCsv(file: File) {
  const fd = new FormData();
  fd.append("file", file);
  return request<TopicImportResult>("/topics/import-csv", {
    method: "POST",
    body: fd
  });
}

export function triggerGeneration(topicId: string) {
  return request<{ version_id: string }>(`/content/${topicId}/generate`, { method: "POST" });
}

export function regenerateContent(topicId: string, channels: string[] = []) {
  return request<{ version_id: string }>(`/content/${topicId}/regenerate`, {
    method: "POST",
    body: JSON.stringify({ channels })
  });
}

export function listCurrentVariants(topicId: string) {
  return request<ContentChannelVariant[]>(`/content/${topicId}/variants/current`);
}

export function updateVariant(
  topicId: string,
  channel: ContentChannelVariant["channel"],
  payload: Pick<ContentChannelVariant, "title" | "article_body" | "summary">
) {
  return request<ContentChannelVariant>(`/content/${topicId}/variants/${channel}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function approveVariant(topicId: string, channel: ContentChannelVariant["channel"]) {
  return request<ContentChannelVariant>(`/content/${topicId}/variants/${channel}/approve`, {
    method: "POST"
  });
}

export function approveVariantPart(
  topicId: string,
  channel: ContentChannelVariant["channel"],
  part: "text" | "image"
) {
  return request<ContentChannelVariant>(`/content/${topicId}/variants/${channel}/${part}/approve`, {
    method: "POST"
  });
}

export function rejectVariant(topicId: string, channel: ContentChannelVariant["channel"]) {
  return request<ContentChannelVariant>(`/content/${topicId}/variants/${channel}/reject`, {
    method: "POST"
  });
}

export function rejectVariantPart(
  topicId: string,
  channel: ContentChannelVariant["channel"],
  part: "text" | "image",
  note: string
) {
  return request<ContentChannelVariant>(`/content/${topicId}/variants/${channel}/${part}/reject`, {
    method: "POST",
    body: JSON.stringify({ note })
  });
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

export function getCurrentSchedule(topicId: string) {
  return request<CurrentSchedule>(`/content/${topicId}/schedule/current`);
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

export function getSchedulerOverview() {
  return request<SchedulerOverview>("/content/scheduler/overview");
}

export function getGeneratedImageBlob(imageId: string) {
  return requestBlob(`/content/images/${imageId}`);
}

export function listActivityFeed(filters: ActivityFeedFilters = {}) {
  const params = new URLSearchParams();
  if (filters.event_type?.trim()) {
    params.set("event_type", filters.event_type.trim());
  }
  if (filters.topic?.trim()) {
    params.set("topic", filters.topic.trim());
  }
  if (filters.period) {
    params.set("period", filters.period);
  }
  if (typeof filters.limit === "number") {
    params.set("limit", String(filters.limit));
  }
  const suffix = params.size > 0 ? `?${params.toString()}` : "";
  return request<ActivityFeedItem[]>(`/content/activity${suffix}`);
}

export function listNotificationFeed(filters: NotificationFeedFilters = {}) {
  const params = new URLSearchParams();
  if (filters.event_type?.trim()) {
    params.set("event_type", filters.event_type.trim());
  }
  if (filters.status) {
    params.set("status", filters.status);
  }
  if (filters.topic?.trim()) {
    params.set("topic", filters.topic.trim());
  }
  if (filters.period) {
    params.set("period", filters.period);
  }
  if (typeof filters.limit === "number") {
    params.set("limit", String(filters.limit));
  }
  const suffix = params.size > 0 ? `?${params.toString()}` : "";
  return request<NotificationFeedItem[]>(`/content/notifications${suffix}`);
}

export function listAdminThemes() {
  return request<AdminTheme[]>("/admin/themes");
}

export function createAdminTheme(name: string) {
  return request<AdminTheme>("/admin/themes", {
    method: "POST",
    body: JSON.stringify({ name })
  });
}

export function updateAdminTheme(themeId: string, payload: Partial<Pick<AdminTheme, "name" | "is_active">>) {
  return request<AdminTheme>(`/admin/themes/${themeId}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function listAdminScheduleTemplates() {
  return request<AdminScheduleTemplate[]>("/admin/schedule-templates");
}

export function listAdminActivity() {
  return request<AdminActivity[]>("/admin/activity");
}

export function listAuditEvents(topicId: string) {
  return request<AuditEvent[]>(`/topics/${topicId}/audit-events`);
}
