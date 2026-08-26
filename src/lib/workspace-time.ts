/**
 * Timezone helpers for workspace-local scheduling decisions.
 *
 * Dates are stored as absolute UTC instants; anything hour-of-day based
 * (quiet hours, "post at 9am") must be evaluated in the workspace timezone.
 */

/** Current hour (0-23) in the given IANA timezone. Falls back to UTC hour. */
export function hourInTimezone(date: Date, timeZone?: string | null): number {
  if (!timeZone) return date.getUTCHours();
  try {
    const formatted = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "numeric",
      hourCycle: "h23",
    }).format(date);
    const hour = Number(formatted);
    return Number.isFinite(hour) ? hour : date.getUTCHours();
  } catch {
    return date.getUTCHours();
  }
}

/**
 * Whether `date` falls inside a [startHour, endHour) quiet window in the
 * workspace timezone. Equal start/end means quiet hours are disabled.
 * Overnight windows (start > end, e.g. 22:00-06:00) are supported.
 */
export function isInQuietHours(input: {
  date: Date;
  timeZone?: string | null;
  startHour: number;
  endHour: number;
}): boolean {
  const { startHour, endHour } = input;
  if (startHour === endHour) return false;
  const hour = hourInTimezone(input.date, input.timeZone);
  return startHour < endHour
    ? hour >= startHour && hour < endHour
    : hour >= startHour || hour < endHour;
}

/** Format a UTC Date for display in the workspace timezone. */
export function formatInTimezone(
  date: Date,
  timeZone?: string | null,
  options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  },
): string {
  try {
    return new Intl.DateTimeFormat("id-ID", {
      ...(timeZone ? { timeZone } : {}),
      ...options,
    }).format(date);
  } catch {
    return date.toISOString();
  }
}
