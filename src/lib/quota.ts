export type QuotaStatus = "ok" | "warning" | "critical";

export function getThresholdStatus(used: number, limit: number): QuotaStatus {
  if (limit <= 0) return "ok";
  const pct = used / limit;
  if (pct >= 1) return "critical";
  if (pct >= 0.8) return "warning";
  return "ok";
}

export function getQuotaPercent(used: number, limit: number): number {
  if (limit <= 0) return 0;
  return Math.min(100, Math.round((used / limit) * 100));
}

export function quotaColor(status: QuotaStatus): string {
  if (status === "critical") return "destructive";
  if (status === "warning") return "warning";
  return "default";
}

export function formatQuota(used: number, limit: number): string {
  return `${used.toLocaleString()} / ${limit.toLocaleString()}`;
}

export const THRESHOLDS = { warning: 80, critical: 100 };
