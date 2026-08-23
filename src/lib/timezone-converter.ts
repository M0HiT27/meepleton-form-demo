type DateInput = Date | string;

interface TimeZoneResult {
  formatted: string;   // "YYYY-MM-DD HH:mm:ss" in target zone
  iso: string;          // original instant in ISO/UTC
  parts: Record<string, string>; // year, month, day, hour, minute, second, etc.
}

export default function convertTimeZone(
  input: DateInput,
  timeZone: string = 'Asia/Kolkata',
  locale: string = 'en-CA' // en-CA gives clean YYYY-MM-DD ordering
): TimeZoneResult {
  const date = input instanceof Date ? input : new Date(input);

  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date input: ${input}`);
  }

  const formatter = new Intl.DateTimeFormat(locale, {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date).reduce((acc, part) => {
    if (part.type !== 'literal') acc[part.type] = part.value;
    return acc;
  }, {} as Record<string, string>);

  const formatted = `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;

  return { formatted, iso: date.toISOString(), parts };
}
/**
 * Returns true if the ISO datetime string carries an explicit UTC/offset
 * marker (e.g. "2024-01-01T10:00:00Z" or "...+05:30"). False for naive
 * strings like "2024-01-01T10:00:00" or "2024-01-01 10:00:00" with no
 * offset info at all.
 */
function hasExplicitOffset(dateTimeInput: string): boolean {
  return /(Z|[+-]\d{2}:?\d{2})$/.test(dateTimeInput.trim());
}

/**
 * Parses a datetime string into a UTC Date for DB storage.
 *
 * - If the string has an explicit offset/Z, JS already parses it correctly
 *   — just use `new Date()` directly.
 * - If it's naive (no offset), we don't actually know what zone the
 *   client meant, so rather than silently guessing, this throws — the
 *   caller must send an unambiguous timestamp.
 */
export function toUtcForDb(dateTimeInput: string): Date {
  const trimmed = dateTimeInput.trim();

  if (!hasExplicitOffset(trimmed)) {
    throw new Error(
      `Datetime "${dateTimeInput}" has no timezone offset — send an ISO string with Z or ±HH:mm so it's unambiguous.`
    );
  }

  const date = new Date(trimmed);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date input: ${dateTimeInput}`);
  }

  return date; // already the correct UTC instant
}