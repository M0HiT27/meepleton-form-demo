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