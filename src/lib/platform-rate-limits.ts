/**
 * Platform rate-limit guardrails (Instagram / Threads / TikTok).
 *
 * These are CONSERVATIVE operational estimates, not official platform
 * numbers — Meta/TikTok do not publish exact automation caps and enforce
 * them heuristically (velocity, duplicates, account age, trust). Staying
 * well under these caps keeps accounts out of "limited / action blocked /
 * shadow-restricted" states.
 *
 * Enforcement points:
 * - `clampDailyQuota` / `validateCampaignPacing` — creation-time guard so an
 *   operator cannot configure an unsafe campaign.
 * - `checkHourlyPace` + `checkMinInterval` — runtime guard consumed by
 *   `runSendPreflight` and the worker sliding-window checks.
 * - `isRateLimitFailure` — classifies provider 429 / "action blocked"
 *   responses so the worker can quarantine the account instead of retrying
 *   into a ban.
 */

export type PlatformName = "instagram" | "threads" | "tiktok";

export type PlatformGuardrail = {
  platform: PlatformName;
  label: string;
  /** Max outbound comments/replies that look human. */
  comments: {
    safePerHour: number;
    safePerDay: number;
    /** Minimum seconds between two comments from the same account. */
    minIntervalSec: number;
    /** Daily cap for accounts younger than NEW_ACCOUNT_DAYS. */
    newAccountPerDay: number;
  };
  /** Max native posts/publishes per account. */
  publishes: {
    safePerHour: number;
    safePerDay: number;
    minIntervalSec: number;
  };
  /** Max read/discovery calls (hashtag search, polls) per account. */
  discovers: {
    safePerHour: number;
    minIntervalSec: number;
  };
  notes: string[];
};

/** Accounts younger than this get the stricter new-account cap. */
export const NEW_ACCOUNT_DAYS = 30;

/**
 * Conservative per-platform caps. Deliberately set to ~30-50% of the
 * numbers circulating in creator/community reports so normal variance
 * (retries, mention auto-replies, manual sends) still stays safe.
 */
export const PLATFORM_GUARDRAILS: Record<PlatformName, PlatformGuardrail> = {
  instagram: {
    platform: "instagram",
    label: "Instagram",
    comments: {
      safePerHour: 12,
      safePerDay: 50,
      minIntervalSec: 180,
      newAccountPerDay: 15,
    },
    publishes: { safePerHour: 2, safePerDay: 8, minIntervalSec: 1800 },
    discovers: { safePerHour: 20, minIntervalSec: 120 },
    notes: [
      "Satu komentar unik per target; jangan kirim teks identik berulang.",
      "Akun < 30 hari: maksimal 15 komentar/hari selama warming.",
      "Jeda antar komentar minimal 3 menit (human-like, acak 3–10 mnt).",
    ],
  },
  threads: {
    platform: "threads",
    label: "Threads",
    comments: {
      safePerHour: 10,
      safePerDay: 40,
      minIntervalSec: 240,
      newAccountPerDay: 10,
    },
    publishes: { safePerHour: 3, safePerDay: 10, minIntervalSec: 1200 },
    discovers: { safePerHour: 20, minIntervalSec: 120 },
    notes: [
      "Reply Threads dihitung sebagai post — jeda minimal 4 menit.",
      "Akun < 30 hari: maksimal 10 balasan/hari selama warming.",
    ],
  },
  tiktok: {
    platform: "tiktok",
    label: "TikTok",
    comments: {
      safePerHour: 8,
      safePerDay: 30,
      minIntervalSec: 300,
      newAccountPerDay: 10,
    },
    publishes: { safePerHour: 1, safePerDay: 4, minIntervalSec: 3600 },
    discovers: { safePerHour: 15, minIntervalSec: 180 },
    notes: [
      "TikTok paling agresif mendeteksi komentar berpola — variasikan teks.",
      "Jeda antar komentar minimal 5 menit; posting video maksimal 4/hari.",
    ],
  },
};

const GENERIC_GUARDRAIL: PlatformGuardrail = {
  platform: "instagram",
  label: "Unknown",
  comments: {
    safePerHour: 8,
    safePerDay: 30,
    minIntervalSec: 300,
    newAccountPerDay: 10,
  },
  publishes: { safePerHour: 1, safePerDay: 4, minIntervalSec: 3600 },
  discovers: { safePerHour: 15, minIntervalSec: 180 },
  notes: ["Platform tidak dikenal — pakai cap paling konservatif."],
};

export function normalizePlatform(raw?: string | null): PlatformName | null {
  const v = (raw || "").trim().toLowerCase();
  if (v === "instagram" || v === "ig") return "instagram";
  if (v === "threads") return "threads";
  if (v === "tiktok" || v === "tik-tok") return "tiktok";
  return null;
}

export function getPlatformGuardrail(platform?: string | null): PlatformGuardrail {
  const key = normalizePlatform(platform);
  if (!key) return GENERIC_GUARDRAIL;
  return PLATFORM_GUARDRAILS[key];
}

export function isNewAccount(createdAt?: Date | string | null, now: Date = new Date()): boolean {
  if (!createdAt) return false;
  const created = createdAt instanceof Date ? createdAt : new Date(createdAt);
  if (Number.isNaN(created.getTime())) return false;
  const ageMs = now.getTime() - created.getTime();
  return ageMs >= 0 && ageMs < NEW_ACCOUNT_DAYS * 24 * 60 * 60 * 1000;
}

/** Effective daily comment cap = strictest of platform cap, new-account cap, operator quota. */
export function effectiveDailyCommentCap(input: {
  platform?: string | null;
  accountCreatedAt?: Date | string | null;
  customDailyQuota?: number | null;
  now?: Date;
}): number {
  const guardrail = getPlatformGuardrail(input.platform);
  const now = input.now ?? new Date();
  const platformCap = isNewAccount(input.accountCreatedAt, now)
    ? Math.min(guardrail.comments.safePerDay, guardrail.comments.newAccountPerDay)
    : guardrail.comments.safePerDay;
  const custom = input.customDailyQuota;
  if (typeof custom === "number" && Number.isFinite(custom) && custom > 0) {
    return Math.max(1, Math.min(Math.floor(custom), platformCap));
  }
  return platformCap;
}

export type HourlyPaceResult = {
  ok: boolean;
  sentInLastHour: number;
  cap: number;
  remaining: number;
  retryAfterSec: number;
  message: string | null;
};

/** Sliding 60-minute window check. `retryAfterSec` estimates when the oldest send ages out. */
export function checkHourlyPace(input: {
  platform?: string | null;
  kind: "comments" | "publishes" | "discovers";
  sentInLastHour: number;
}): HourlyPaceResult {
  const guardrail = getPlatformGuardrail(input.platform);
  const cap =
    input.kind === "comments"
      ? guardrail.comments.safePerHour
      : input.kind === "publishes"
        ? guardrail.publishes.safePerHour
        : guardrail.discovers.safePerHour;
  const sent = Math.max(0, Math.floor(input.sentInLastHour || 0));
  if (sent >= cap) {
    return {
      ok: false,
      sentInLastHour: sent,
      cap,
      remaining: 0,
      retryAfterSec: 15 * 60,
      message: `Batas aman per-jam ${guardrail.label} tercapai (${sent}/${cap} ${input.kind}/jam) — jeda agar tidak terdeteksi spam`,
    };
  }
  return {
    ok: true,
    sentInLastHour: sent,
    cap,
    remaining: cap - sent,
    retryAfterSec: 0,
    message: null,
  };
}

export type MinIntervalResult = {
  ok: boolean;
  waitSec: number;
  message: string | null;
};

/** Minimum gap between two outbound actions from the same account. */
export function checkMinInterval(input: {
  platform?: string | null;
  kind: "comments" | "publishes" | "discovers";
  lastActionAt?: Date | string | null;
  now?: Date;
}): MinIntervalResult {
  const guardrail = getPlatformGuardrail(input.platform);
  const minSec =
    input.kind === "comments"
      ? guardrail.comments.minIntervalSec
      : input.kind === "publishes"
        ? guardrail.publishes.minIntervalSec
        : guardrail.discovers.minIntervalSec;
  if (!input.lastActionAt) return { ok: true, waitSec: 0, message: null };
  const last = input.lastActionAt instanceof Date ? input.lastActionAt : new Date(input.lastActionAt);
  if (Number.isNaN(last.getTime())) return { ok: true, waitSec: 0, message: null };
  const now = input.now ?? new Date();
  const elapsedSec = Math.floor((now.getTime() - last.getTime()) / 1000);
  if (elapsedSec >= minSec) return { ok: true, waitSec: 0, message: null };
  const waitSec = minSec - elapsedSec;
  return {
    ok: false,
    waitSec,
    message: `Terlalu cepat setelah aksi sebelumnya — tunggu ~${Math.ceil(waitSec / 60)} menit lagi (jeda aman ${guardrail.label} ${minSec / 60} mnt)`,
  };
}

/**
 * Validate campaign pacing at creation time. Returns hard errors (block
 * creation) plus soft warnings (shown but allowed).
 */
export function validateCampaignPacing(input: {
  platform?: string | null;
  dailyLimit?: number | null;
  minDelaySec?: number | null;
  maxDelaySec?: number | null;
}): { errors: string[]; warnings: string[]; clampedDailyLimit: number } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const guardrail = getPlatformGuardrail(input.platform);

  const dailyLimit =
    typeof input.dailyLimit === "number" && Number.isFinite(input.dailyLimit)
      ? Math.floor(input.dailyLimit)
      : guardrail.comments.safePerDay;
  const clampedDailyLimit = Math.max(1, Math.min(dailyLimit, guardrail.comments.safePerDay));
  if (dailyLimit > guardrail.comments.safePerDay) {
    errors.push(
      `Daily limit ${dailyLimit} melebihi batas aman ${guardrail.label} (${guardrail.comments.safePerDay}/hari) — turunkan agar akun tidak dibatasi`,
    );
  }
  if (dailyLimit <= 0) errors.push("Daily limit minimal 1");

  const minDelay = input.minDelaySec ?? guardrail.comments.minIntervalSec;
  const maxDelay = input.maxDelaySec ?? Math.max(minDelay, guardrail.comments.minIntervalSec * 2);
  if (minDelay < guardrail.comments.minIntervalSec) {
    errors.push(
      `Min delay ${minDelay}s terlalu cepat untuk ${guardrail.label} (minimal ${guardrail.comments.minIntervalSec}s ≈ ${guardrail.comments.minIntervalSec / 60} mnt antar komentar)`,
    );
  }
  if (maxDelay < minDelay) errors.push("Max delay harus >= min delay");
  if (minDelay >= 5 && minDelay < guardrail.comments.minIntervalSec * 2) {
    warnings.push(
      `Jeda ${minDelay}s masih agresif untuk ${guardrail.label} — disarankan acak ${guardrail.comments.minIntervalSec}–${guardrail.comments.minIntervalSec * 3}s agar terlihat manusiawi`,
    );
  }
  return { errors, warnings, clampedDailyLimit };
}

/** Validate content-publish pacing (posts are rarer & heavier than comments). */
export function validatePublishPacing(input: {
  platform?: string | null;
  postsPerDay?: number | null;
  intervalHours?: number | null;
}): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const guardrail = getPlatformGuardrail(input.platform);
  if (typeof input.postsPerDay === "number" && input.postsPerDay > guardrail.publishes.safePerDay) {
    errors.push(
      `Posting ${input.postsPerDay}/hari melebihi batas aman ${guardrail.label} (${guardrail.publishes.safePerDay}/hari)`,
    );
  }
  if (typeof input.intervalHours === "number" && input.intervalHours > 0) {
    const intervalSec = input.intervalHours * 3600;
    if (intervalSec < guardrail.publishes.minIntervalSec) {
      errors.push(
        `Interval posting terlalu rapat untuk ${guardrail.label} (minimal tiap ${guardrail.publishes.minIntervalSec / 3600} jam)`,
      );
    }
  }
  return { errors, warnings };
}

const RATE_LIMIT_PATTERNS = [
  "429",
  "rate limit",
  "ratelimit",
  "too many requests",
  "action blocked",
  "action_blocked",
  "temporarily blocked",
  "temporary block",
  "try again later",
  "spam",
  "restrict",
  "checkpoint",
  "suspicious activity",
  "limit reached",
  "quota exceeded",
  "slow down",
];

/** True when a provider/bridge error means "platform throttled us". */
export function isRateLimitFailure(message?: string | null): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  return RATE_LIMIT_PATTERNS.some((p) => m.includes(p));
}

/** Short human-readable summary for UI/docs, e.g. "12/jam · 50/hari · jeda 3 mnt". */
export function describePlatformLimits(platform?: string | null): string {
  const g = getPlatformGuardrail(platform);
  return `${g.comments.safePerHour}/jam · ${g.comments.safePerDay}/hari · jeda ${g.comments.minIntervalSec / 60} mnt (post ${g.publishes.safePerDay}/hari)`;
}
