import type { WorkHourGroup } from "../../../lib/api/client";

export const minutesForGroup = (group: WorkHourGroup) => group.duration_minutes ?? (group.duration_half_hours ?? 0) * 30;

export function formatMinutes(minutes: number): string {
  const value = Math.round(minutes);
  const hours = Math.floor(value / 60);
  const remainder = value % 60;
  return hours ? `${hours} uur${remainder ? ` ${remainder} min` : ""}` : `${remainder} min`;
}

export const formatHours = (hours: number) => new Intl.NumberFormat("nl-NL", { maximumFractionDigits: 2 }).format(hours);

export function parseDuration(value: string, unit: "minutes" | "hours"): number | null {
  const normalized = value.trim().replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  const minutes = Number(normalized) * (unit === "hours" ? 60 : 1);
  const rounded = Math.round(minutes);
  if (!Number.isFinite(minutes) || Math.abs(minutes - rounded) > 0.000001 || rounded < 1 || rounded > 1440) return null;
  return rounded;
}

export function workHoursError(error: unknown): string {
  if (!(error instanceof Error)) return "Het verzoek kon niet worden afgerond. Probeer opnieuw.";
  try {
    const { detail } = JSON.parse(error.message);
    if (typeof detail === "string") return detail;
    if (detail?.message) return String(detail.message);
    if (Array.isArray(detail)) return "Controleer de datum, begintijd, duur en geselecteerde personen.";
  } catch { /* Plain network errors receive a safe, readable message. */ }
  return "Het verzoek kon niet worden afgerond. Controleer je verbinding en probeer opnieuw.";
}
