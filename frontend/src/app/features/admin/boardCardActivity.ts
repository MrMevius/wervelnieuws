const DAY_MS = 24 * 60 * 60 * 1000;

/** Cards in "Bezig" without activity for this long are marked as stalled. */
export const STALE_DOING_DAYS = 21;
/** "Klaar" shows this many cards until the column is expanded. */
export const DONE_VISIBLE_LIMIT = 8;
/** Done cards quiet for this long are offered for archiving. */
export const DONE_ARCHIVE_SUGGESTION_DAYS = 30;

export function cardActivityAgeDays(value: string | null | undefined, nowMs: number = Date.now()): number | null {
  if (!value) return null;
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return null;
  const startOfToday = new Date(nowMs);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfDay = new Date(timestamp);
  startOfDay.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((startOfToday.getTime() - startOfDay.getTime()) / DAY_MS));
}

export function formatCardActivityAge(days: number): string {
  if (days === 0) return "vandaag";
  if (days === 1) return "gisteren";
  if (days < 14) return `${days} dagen geleden`;
  if (days < 60) return `${Math.floor(days / 7)} weken geleden`;
  if (days < 365) return `${Math.floor(days / 30)} maanden geleden`;
  const years = Math.floor(days / 365);
  return years === 1 ? "1 jaar geleden" : `${years} jaar geleden`;
}
