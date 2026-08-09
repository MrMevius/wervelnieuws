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
