export function normalizePollIntervalMinutes(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) throw new Error("Poll interval must be a number");
  const minutes = Math.trunc(parsed);
  if (minutes < 15 || minutes > 10080) {
    throw new Error("Poll interval must be between 15 minutes and 7 days (10080)");
  }
  return minutes;
}
