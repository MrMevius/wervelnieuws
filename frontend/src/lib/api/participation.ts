import { request, requestBlob } from "./client";

export type ParticipationOption = { id: string; name: string; selectable: boolean; avatar_user_id?: string | null };
export type ContactType = "in_person" | "phone" | "email" | "video" | "meeting" | "letter" | "newspaper" | "online" | "other";
export type MomentType = "conversation" | "meeting" | "communication";
export type ParticipationLevel = "inform" | "consult" | "advise" | "coproduce" | "codecide";
export type YesNoStatus = "" | "yes" | "no" | "na";
export type GoalStatus = "" | "yes" | "partial" | "no" | "pending" | "na";
export type ParticipationDraft = {
  title: string; occurred_on: string; contact_type: ContactType; conversation_partners: string;
  location: string; duration_minutes: number | null; report: string; agreements: string;
  moment_type: MomentType; goal: string; participation_levels: ParticipationLevel[]; collected_information: string;
  invitation_status: YesNoStatus; invitation_note: string; informed_status: YesNoStatus; informed_note: string;
  feedback_status: YesNoStatus; feedback_note: string; goal_status: GoalStatus; notes: string; is_historical: boolean;
  participant_ids: string[]; project_ids: string[];
};
export type ParticipationMoment = Omit<ParticipationDraft, "participant_ids" | "project_ids"> & {
  id: string; participants: ParticipationOption[]; projects: ParticipationOption[];
  created_by_name: string; created_at: string; updated_at: string; archived_at: string | null;
  row_version: number; can_edit: boolean;
};
export type ParticipationMeta = { participants: ParticipationOption[]; projects: ParticipationOption[]; current_user_id: string };
export type ParticipationFilters = {
  query: string; date_from: string; date_to: string; project_id: string; participant_id: string;
  moment_type: MomentType | ""; participation_level: ParticipationLevel | ""; goal_status: GoalStatus; archived: boolean;
};
export type ParticipationList = {
  items: ParticipationMoment[]; total: number; page: number; page_size: number;
  month_counts?: Array<{ month: string; moments: number }>; type_counts?: Partial<Record<MomentType, number>>;
};
export type ParticipationExportFormat = "csv" | "markdown" | "json";

function queryString(values: Record<string, string | number | boolean>): string {
  return new URLSearchParams(Object.entries(values).filter(([, value]) => value !== "").map(([key, value]) => [key, String(value)])).toString();
}
const base = "/participatiemomenten";
export const getParticipationMeta = () => request<ParticipationMeta>(`${base}/meta`);
export const listParticipationMoments = (filters: ParticipationFilters, page = 1, pageSize = 25) =>
  request<ParticipationList>(`${base}?${queryString({ ...filters, page, page_size: pageSize })}`);
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
