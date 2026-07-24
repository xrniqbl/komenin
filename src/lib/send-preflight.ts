import { scanContentRisk, type RiskResult } from "@/lib/risk-scanner";

export type SendPreflightInput = {
  body: string;
  postContent?: string | null;
  bannedPhrases?: string[];
  customRules?: Array<{
    id?: string;
    type: string;
    pattern: string;
    severity?: string;
    isActive?: boolean;
  }>;
  account?: {
    status?: string | null;
    healthScore?: number | null;
    actionsToday?: number | null;
    dailyQuota?: number | null;
  } | null;
  /** Recent identical bodies already sent to the same target (lowercased). */
  recentBodies?: string[];
  quietHours?: {
    /** Workspace timezone is advisory only — use local hour from caller if needed. */
    startHour: number;
    endHour: number;
    currentHour: number;
  } | null;
  monthly?: {
    sendsUsed: number;
    sendLimit: number;
  } | null;
};

export type SendPreflightResult = {
  ok: boolean;
  blocked: boolean;
  reasons: string[];
  warnings: string[];
  risk: RiskResult;
};

function normalizeBody(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Pre-flight checks before a comment is delivered.
 * Fail closed on high risk / quota / unhealthy account.
 */
export function runSendPreflight(input: SendPreflightInput): SendPreflightResult {
  const reasons: string[] = [];
  const warnings: string[] = [];
  const body = input.body?.trim() || "";

  if (!body) {
    reasons.push("Empty comment body");
  }

  const risk = scanContentRisk({
    text: body,
    postContent: input.postContent || undefined,
    bannedPhrases: input.bannedPhrases,
    customRules: input.customRules?.map((r, index) => ({
      id: r.id || `rule_${index}`,
      type: r.type,
      pattern: r.pattern,
      severity: r.severity || "medium",
      isActive: r.isActive !== false,
    })),
  });

  if (risk.blocked) {
    reasons.push(
      `Risk scan blocked send (score ${risk.riskScore}): ${risk.flags.slice(0, 4).join(", ") || "high risk"}`,
    );
  } else if (risk.riskScore >= 0.4) {
    warnings.push(`Elevated risk score ${risk.riskScore}: ${risk.flags.slice(0, 3).join(", ")}`);
  }

  if (input.account) {
    const status = (input.account.status || "").toLowerCase();
    if (status === "limited" || status === "suspended" || status === "banned") {
      reasons.push(`Account status is ${status} — re-auth or wait before sending`);
    } else if (status === "degraded") {
      warnings.push("Account is degraded — send may fail");
    }
    if ((input.account.healthScore ?? 100) < 30) {
      reasons.push(`Account health too low (${input.account.healthScore})`);
    } else if ((input.account.healthScore ?? 100) < 55) {
      warnings.push(`Account health low (${input.account.healthScore})`);
    }
    const used = input.account.actionsToday ?? 0;
    const quota = input.account.dailyQuota ?? 0;
    if (quota > 0 && used >= quota) {
      reasons.push(`Daily account quota reached (${used}/${quota})`);
    } else if (quota > 0 && used / quota >= 0.9) {
      warnings.push(`Daily account quota nearly full (${used}/${quota})`);
    }
  }

  if (input.monthly && input.monthly.sendLimit > 0) {
    if (input.monthly.sendsUsed >= input.monthly.sendLimit) {
      reasons.push(
        `Monthly send limit reached (${input.monthly.sendsUsed}/${input.monthly.sendLimit})`,
      );
    }
  }

  if (input.recentBodies && body) {
    const norm = normalizeBody(body);
    if (input.recentBodies.some((b) => normalizeBody(b) === norm)) {
      reasons.push("Duplicate body recently sent to this target");
    }
  }

  if (input.quietHours) {
    const { startHour, endHour, currentHour } = input.quietHours;
    const inQuiet =
      startHour === endHour
        ? false
        : startHour < endHour
          ? currentHour >= startHour && currentHour < endHour
          : currentHour >= startHour || currentHour < endHour;
    if (inQuiet) {
      reasons.push(`Quiet hours active (${startHour}:00–${endHour}:00)`);
    }
  }

  return {
    ok: reasons.length === 0,
    blocked: reasons.length > 0,
    reasons,
    warnings,
    risk,
  };
}
