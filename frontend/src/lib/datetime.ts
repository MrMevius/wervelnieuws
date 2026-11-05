const AMSTERDAM_DATE_TIME_FORMATTER = new Intl.DateTimeFormat("nl-NL", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Europe/Amsterdam"
});

const AMSTERDAM_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "Europe/Amsterdam"
});

const AMSTERDAM_DISPLAY_DATE_FORMATTER = new Intl.DateTimeFormat("nl-NL", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "Europe/Amsterdam"
});

const ISO_WITH_TIMEZONE_PATTERN = /(Z|[+-]\d{2}:?\d{2})$/i;
const ISO_WITH_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

function parseTimestampAsUtcWhenNaive(value: string): Date {
  const trimmedValue = value.trim();
  const normalizedValue = ISO_WITH_TIME_PATTERN.test(trimmedValue) && !ISO_WITH_TIMEZONE_PATTERN.test(trimmedValue)
    ? `${trimmedValue}Z`
    : trimmedValue;
  return new Date(normalizedValue);
}

export function formatAmsterdamDateTime(value: string | Date): string {
  const date = value instanceof Date ? value : parseTimestampAsUtcWhenNaive(value);

  if (Number.isNaN(date.getTime())) {
    return "Datum onbekend";
  }

  return AMSTERDAM_DATE_TIME_FORMATTER.format(date);
}

export function formatAmsterdamDateInput(value: string | Date = new Date()): string {
  const date = value instanceof Date ? value : parseTimestampAsUtcWhenNaive(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const parts = AMSTERDAM_DATE_FORMATTER.formatToParts(date).reduce<Record<string, string>>((accumulator, part) => {
    if (part.type !== "literal") {
      accumulator[part.type] = part.value;
    }
    return accumulator;
  }, {});

  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function formatAmsterdamDisplayDate(value: string | Date): string {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-");
    return `${day}-${month}-${year}`;
  }
  const date = value instanceof Date ? value : parseTimestampAsUtcWhenNaive(value);
  if (Number.isNaN(date.getTime())) return "Datum onbekend";
  const parts = AMSTERDAM_DISPLAY_DATE_FORMATTER.formatToParts(date).reduce<Record<string, string>>((result, part) => {
    if (part.type !== "literal") result[part.type] = part.value;
    return result;
  }, {});
  return `${parts.day}-${parts.month}-${parts.year}`;
}

const AMSTERDAM_TIME_FORMATTER = new Intl.DateTimeFormat("nl-NL", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Amsterdam"
});

const AMSTERDAM_DAY_FORMATTER = new Intl.DateTimeFormat("nl-NL", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "Europe/Amsterdam"
});

export function formatAmsterdamTime(value: string | Date): string {
  const date = value instanceof Date ? value : parseTimestampAsUtcWhenNaive(value);
  return Number.isNaN(date.getTime()) ? "--:--" : AMSTERDAM_TIME_FORMATTER.format(date);
}

/** "Vandaag", "Gisteren" or e.g. "dinsdag 27 oktober" (with year when not the current year). */
export function formatAmsterdamDayLabel(value: string | Date, now: Date = new Date()): string {
  const date = value instanceof Date ? value : parseTimestampAsUtcWhenNaive(value);
  if (Number.isNaN(date.getTime())) return "Datum onbekend";
  const day = formatAmsterdamDateInput(date);
  if (day === formatAmsterdamDateInput(now)) return "Vandaag";
  if (day === formatAmsterdamDateInput(new Date(now.getTime() - 24 * 60 * 60 * 1000))) return "Gisteren";
  const label = AMSTERDAM_DAY_FORMATTER.format(date);
  return day.slice(0, 4) === formatAmsterdamDateInput(now).slice(0, 4) ? label : `${label} ${day.slice(0, 4)}`;
}
