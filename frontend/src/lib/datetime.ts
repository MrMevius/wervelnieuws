const AMSTERDAM_DATE_TIME_FORMATTER = new Intl.DateTimeFormat("nl-NL", {
  dateStyle: "short",
  timeStyle: "short",
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
