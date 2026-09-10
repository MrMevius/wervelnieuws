import { request, requestBlob } from "./client";

export type ParticipationOption = { id: string; name: string; selectable: boolean };
export type ContactType = "in_person" | "phone" | "video" | "other";
export type ParticipationDraft = {
  title: string; occurred_on: string; contact_type: ContactType; conversation_partners: string;
  location: string; duration_minutes: number | null; report: string; agreements: string;
  participant_ids: string[]; project_ids: string[];
};
export type ParticipationMoment = Omit<ParticipationDraft, "participant_ids" | "project_ids"> & {
  id: string; participants: ParticipationOption[]; projects: ParticipationOption[];
  created_by_name: string; created_at: string; updated_at: string; archived_at: string | null;
  row_version: number; can_edit: boolean;
};
export type ParticipationMeta = { participants: ParticipationOption[]; projects: ParticipationOption[]; current_user_id: string };
export type ParticipationFilters = {
  query: string; date_from: string; date_to: string; project_id: string; participant_id: string; archived: boolean;
};
export type ParticipationList = { items: ParticipationMoment[]; total: number; page: number; page_size: number };
export type ParticipationExportFormat = "csv" | "markdown" | "json";

function queryString(values: Record<string, string | number | boolean>): string {
  return new URLSearchParams(Object.entries(values).filter(([, value]) => value !== "").map(([key, value]) => [key, String(value)])).toString();
}
const base = "/participatiemomenten";
export const getParticipationMeta = () => request<ParticipationMeta>(`${base}/meta`);
export const listParticipationMoments = (filters: ParticipationFilters, page = 1) =>
  request<ParticipationList>(`${base}?${queryString({ ...filters, page, page_size: 25 })}`);
export const getParticipationMoment = (id: string) => request<ParticipationMoment>(`${base}/${encodeURIComponent(id)}`);
export const createParticipationMoment = (draft: ParticipationDraft) =>
  request<ParticipationMoment>(base, { method: "POST", body: JSON.stringify(draft) });
export const updateParticipationMoment = (id: string, draft: ParticipationDraft, version: number) =>
  request<ParticipationMoment>(`${base}/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify({ ...draft, expected_row_version: version }) });
export const archiveParticipationMoment = (id: string, archived: boolean, version: number) =>
  request<ParticipationMoment>(`${base}/${encodeURIComponent(id)}/archive`, { method: "PATCH", body: JSON.stringify({ archived, expected_row_version: version }) });
export const exportParticipationMoments = (filters: ParticipationFilters, format: ParticipationExportFormat) =>
  requestBlob(`${base}/export?${queryString({ ...filters, format })}`);

export function participationError(error: unknown): string {
  if (!(error instanceof Error)) return "Er ging iets mis. Probeer opnieuw.";
  try {
    const { detail } = JSON.parse(error.message);
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) return detail.map(item => item.msg).join(" ");
  } catch { /* Network and plain error messages are handled below. */ }
  return "Het verzoek kon niet worden afgerond. Controleer je verbinding en probeer opnieuw.";
}
