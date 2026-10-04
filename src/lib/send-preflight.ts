import { scanContentRisk, type RiskResult } from "@/lib/risk-scanner";
import {
  checkHourlyPace,
  checkMinInterval,
  effectiveDailyCommentCap,
  getPlatformGuardrail,
} from "@/lib/platform-rate-limits";

export type SendPreflightInput = {
  body: string;
  postContent?: string | null;
  platform?: string | null;
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
    /** Account creation date — enables the stricter new-account (<30d) cap. */
    createdAt?: Date | string | null;
    lastActionAt?: Date | string | null;
  } | null;
  /** Sliding-window anti-spam signals (from DeliveryLog, UTC). */
  pace?: {
    /** Successful sends from this account in the last 60 minutes. */
    sentInLastHour?: number | null;
    /** Timestamp of the account's most recent outbound action. */
    lastActionAt?: Date | string | null;
    now?: Date;
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
  /** Transient pace deferral (seconds) — caller should reschedule, not fail. */
  paceDeferSec: number;
  paceReason: string | null;
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
  let paceDeferSec = 0;
  let paceReason: string | null = null;
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
    // Daily cap: strictest of platform safe cap, new-account warming cap,
    // and the operator-configured quota. The operator can go lower (safer)
    // but never higher than the platform guardrail.
    const guardrail = getPlatformGuardrail(input.platform);
    const customQuota =
      typeof input.account.dailyQuota === "number" ? input.account.dailyQuota : null;
    const cap = effectiveDailyCommentCap({
      platform: input.platform,
      accountCreatedAt: input.account.createdAt ?? null,
      customDailyQuota: customQuota,
    });
    const used = input.account.actionsToday ?? 0;
    if (used >= cap) {
      reasons.push(
        `Daily quota reached (${used}/${cap}) — batas aman harian ${guardrail.label} tercapai (${used}/${cap} komentar/hari), jeda hingga besok agar akun tidak dibatasi`,
      );
    } else if (used / cap >= 0.8) {
      warnings.push(
        `Daily quota nearly full (${used}/${cap}) — mendekati batas aman harian ${guardrail.label}, kurangi tempo agar tidak terdeteksi spam`,
      );
    }

    // Hourly sliding-window pace: catches bursts that the daily counter misses
    // (e.g. 10 sends in 5 minutes on a fresh account).
    if (input.pace && input.pace.sentInLastHour != null) {
      const pace = checkHourlyPace({
        platform: input.platform,
        kind: "comments",
        sentInLastHour: input.pace.sentInLastHour,
      });
      if (!pace.ok) {
        paceDeferSec = Math.max(paceDeferSec, pace.retryAfterSec);
        paceReason = pace.message;
        warnings.push((pace.message || "Hourly pace") + " — pengiriman ditunda ~15 menit");
      }
    }

    // Minimum interval: two comments seconds apart is the #1 bot signature.
    {
      const gap = checkMinInterval({
        platform: input.platform,
        kind: "comments",
        lastActionAt: input.pace?.lastActionAt ?? input.account.lastActionAt ?? null,
        now: input.pace?.now,
      });
      if (!gap.ok) {
        paceDeferSec = Math.max(paceDeferSec, gap.waitSec);
        paceReason = gap.message;
        warnings.push((gap.message || "Too soon") + " — dijadwalkan ulang otomatis");
      }
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
    paceDeferSec,
    paceReason,
  };
}
