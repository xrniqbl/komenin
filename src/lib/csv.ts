/**
 * CSV field escaping with spreadsheet formula-injection protection.
 *
 * Exported lead fields (handle, displayName, notes, ...) are
 * attacker-influenced. A cell starting with = + - @ can execute as a formula
 * when the CSV is opened in Excel/Sheets, so such cells are prefixed with a
 * single quote (the standard mitigation) before quoting.
 */

export function escapeCsvValue(
  value: string | number | null | undefined,
): string {
  const raw = value == null ? "" : String(value);
  // Neutralize formula triggers: =, +, -, @, and tab/CR (DDE prefix attacks).
  const safe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  if (/[",\n\r]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}
