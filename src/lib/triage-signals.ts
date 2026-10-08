export const TRIAGE_OVERDUE_HOURS = 24;

const HIGH_RISK_HINTS = [
  "banned_phrase",
  "promo_claim",
  "custom_rule",
  "toxicity:spam",
];

export type TriageSignals = {
  riskScore: number;
  highRisk: boolean;
  overdue: boolean;
  oldestDraftAt: string | null;
};

function riskScoreFromFlags(flags: string[]): number {
  let score = 0;
  for (const flag of flags) {
    const [type, pattern] = flag.split(":");
    if (type === "banned_phrase" || type === "promo_claim") score += 0.4;
    else if (type === "custom_rule") score += 0.2;
    else if (type === "toxicity" && pattern?.startsWith("spam_")) score += 0.2;
    else if (type === "toxicity") score += 0.1;
    else if (type === "template_reply") score += 0;
    else score += 0.1;
  }
  return Math.min(1, Math.round(score * 100) / 100);
}

function isHighRisk(flags: string[]): boolean {
  return flags.some((flag) =>
    HIGH_RISK_HINTS.some((hint) => flag === hint || flag.startsWith(`${hint}`)),
  );
}

export function triageSignalsForDrafts(
  drafts: Array<{ riskFlags: string[]; status: string; createdAt: Date }>,
): TriageSignals {
  let riskScore = 0;
  let highRisk = false;
  let oldest: Date | null = null;
  for (const draft of drafts) {
    riskScore = Math.max(riskScore, riskScoreFromFlags(draft.riskFlags));
    if (isHighRisk(draft.riskFlags)) highRisk = true;
    if (draft.status === "pending" && (!oldest || draft.createdAt < oldest)) {
      oldest = draft.createdAt;
    }
  }
  const overdue =
    oldest != null &&
    Date.now() - oldest.getTime() > TRIAGE_OVERDUE_HOURS * 3_600_000;
  return {
    riskScore,
    highRisk,
    overdue,
    oldestDraftAt: oldest?.toISOString() ?? null,
  };
}
