// Risk Scanner v2 — composable checks for banned phrases, promo claims, toxicity heuristics.

export type RiskRuleInput = {
  id: string;
  type: string; // banned_phrase | promo_claim | toxicity | custom
  pattern: string;
  severity: string; // low | medium | high
  isActive: boolean;
};

export type RiskFlag = {
  type: string;
  pattern: string;
  severity: string;
  snippet: string;
};

export type RiskResult = {
  flags: string[];
  details: RiskFlag[];
  riskScore: number; // 0-1
  blocked: boolean;
};

const DEFAULT_BANNED = ["judi", "porn", "xxx", "scam", "gratis 100%"];

/** Max length for user-supplied risk patterns (write + scan). */
export const MAX_RISK_PATTERN_LENGTH = 200;
/** Max length of regex body inside /.../ patterns. */
export const MAX_RISK_REGEX_BODY_LENGTH = 80;

const PROMO_CLAIM_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /gratis\s*100\s*%/i, label: "promo_free_100" },
  { pattern: /dijamin\s*untung/i, label: "promo_guaranteed_profit" },
  { pattern: /100\s*%\s*berhasil/i, label: "promo_100_success" },
  { pattern: /cuan\s*instan/i, label: "promo_instant_profit" },
  { pattern: /kaya\s*cepat/i, label: "promo_get_rich_quick" },
  { pattern: /tanpa\s*modal.*untung/i, label: "promo_no_capital_profit" },
  { pattern: /pasti\s*profit/i, label: "promo_guaranteed_profit2" },
  { pattern: /withdraw\s*tanpa\s*syarat/i, label: "promo_unconditional_withdraw" },
];

function snippetAround(text: string, index: number, len = 40): string {
  const start = Math.max(0, index - len);
  const end = Math.min(text.length, index + len);
  return text.slice(start, end).replace(/\s+/g, " ").trim();
}

/**
 * Reject patterns that are likely catastrophic backtracking or too long.
 * Returns null when pattern is acceptable for RegExp use.
 */
export function validateRiskPattern(raw: string): string | null {
  const pattern = raw.trim();
  if (!pattern) return "Pattern is required";
  if (pattern.length > MAX_RISK_PATTERN_LENGTH) {
    return `Pattern too long (max ${MAX_RISK_PATTERN_LENGTH} characters)`;
  }

  if (pattern.startsWith("/") && pattern.lastIndexOf("/") > 0) {
    const lastSlash = pattern.lastIndexOf("/");
    const body = pattern.slice(1, lastSlash);
    const flags = pattern.slice(lastSlash + 1) || "i";
    if (body.length > MAX_RISK_REGEX_BODY_LENGTH) {
      return `Regex body too long (max ${MAX_RISK_REGEX_BODY_LENGTH} characters)`;
    }
    if (!/^[gimsuy]*$/.test(flags)) {
      return "Invalid regex flags";
    }
    // Nested quantifiers / unbounded repeats that commonly enable ReDoS
    // e.g. (a+)+, (a*)*, (a+){2,}, a+b+, consecutive .*.*
    if (
      /\([^)]*[+*][^)]*\)[+*{]/.test(body) ||
      /(\+|\*|\{[^}]+\})\s*(\+|\*|\{)/.test(body) ||
      /(\.\*){2,}|(\.\+){2,}/.test(body)
    ) {
      return "Regex pattern is too complex";
    }
    if (/\(\?[^:=!<]/.test(body)) {
      return "Unsupported regex construct";
    }
    try {
      // Validate the pattern compiles; result intentionally discarded.
      void new RegExp(body, flags);
    } catch {
      return "Invalid regular expression";
    }
  }

  return null;
}

function trySafeRegexMatch(text: string, raw: string): number {
  if (!(raw.startsWith("/") && raw.lastIndexOf("/") > 0)) return -1;
  if (validateRiskPattern(raw)) return -1;

  try {
    const lastSlash = raw.lastIndexOf("/");
    const patternBody = raw.slice(1, lastSlash);
    const flagsStr = raw.slice(lastSlash + 1) || "i";
    // Cap match work: avoid global sticky scans on huge inputs.
    const re = new RegExp(patternBody, flagsStr.replace(/g/g, ""));
    const m = re.exec(text.slice(0, 20_000));
    if (m && m.index !== undefined) return m.index;
  } catch {
    return -1;
  }
  return -1;
}

function scanBannedPhrases(text: string, phrases: string[]): RiskFlag[] {
  const lower = text.toLowerCase();
  const flags: RiskFlag[] = [];
  for (const phrase of phrases) {
    const p = phrase.toLowerCase().trim();
    if (!p || p.length > MAX_RISK_PATTERN_LENGTH) continue;
    const idx = lower.indexOf(p);
    if (idx !== -1) {
      flags.push({
        type: "banned_phrase",
        pattern: phrase,
        severity: "high",
        snippet: snippetAround(text, idx),
      });
    }
  }
  return flags;
}

function scanPatterns(text: string, rules: RiskRuleInput[]): RiskFlag[] {
  const flags: RiskFlag[] = [];
  for (const rule of rules) {
    if (!rule.isActive) continue;
    if (rule.type !== "banned_phrase" && rule.type !== "custom") continue;
    const raw = rule.pattern.trim();
    if (!raw || validateRiskPattern(raw)) continue;

    let found = false;
    let idx = -1;
    if (raw.startsWith("/") && raw.lastIndexOf("/") > 0) {
      idx = trySafeRegexMatch(text, raw);
      found = idx >= 0;
    }
    if (!found) {
      const lower = text.toLowerCase();
      idx = lower.indexOf(raw.toLowerCase());
      found = idx !== -1;
    }

    if (found) {
      flags.push({
        type: rule.type === "custom" ? "custom_rule" : "banned_phrase",
        pattern: raw,
        severity: rule.severity || "medium",
        snippet: snippetAround(text, idx >= 0 ? idx : 0),
      });
    }
  }
  return flags;
}

function detectPromoClaims(text: string): RiskFlag[] {
  const flags: RiskFlag[] = [];
  for (const { pattern, label } of PROMO_CLAIM_PATTERNS) {
    const m = pattern.exec(text);
    if (m && m.index !== undefined) {
      flags.push({
        type: "promo_claim",
        pattern: label,
        severity: "high",
        snippet: snippetAround(text, m.index),
      });
    }
  }
  return flags;
}

function detectToxicityHeuristic(text: string): RiskFlag[] {
  const flags: RiskFlag[] = [];
  const lower = text.toLowerCase();

  // Excessive caps ratio
  const letters = text.replace(/[^A-Za-z]/g, "");
  const caps = text.replace(/[^A-Z]/g, "");
  if (letters.length > 20 && caps.length / letters.length > 0.6) {
    flags.push({
      type: "toxicity",
      pattern: "excessive_caps",
      severity: "low",
      snippet: text.slice(0, 60),
    });
  }

  // Excessive repetition !!!! ????
  if (/!{4,}/.test(text) || /\?{4,}/.test(text)) {
    flags.push({
      type: "toxicity",
      pattern: "excessive_punct",
      severity: "low",
      snippet: text.slice(0, 60),
    });
  }

  // Spam keywords
  const spamTokens = ["beli sekarang", "klik disini", "dm me", "cek bio"];
  for (const tok of spamTokens) {
    if (lower.includes(tok)) {
      flags.push({
        type: "toxicity",
        pattern: `spam_${tok.replace(/\s+/g, "_")}`,
        severity: "medium",
        snippet: snippetAround(text, lower.indexOf(tok)),
      });
      break; // only one spam flag per scan
    }
  }

  return flags;
}

export function scanContentRisk(input: {
  text: string;
  postContent?: string;
  bannedPhrases?: string[];
  customRules?: RiskRuleInput[];
}): RiskResult {
  const combined = `${input.text} ${input.postContent || ""}`;
  const banned = input.bannedPhrases ?? DEFAULT_BANNED;

  const bannedFlags = scanBannedPhrases(combined, banned);
  const ruleFlags = input.customRules ? scanPatterns(combined, input.customRules) : [];
  const promoFlags = detectPromoClaims(input.text);
  const toxFlags = detectToxicityHeuristic(input.text);

  const all = [...bannedFlags, ...ruleFlags, ...promoFlags, ...toxFlags];

  // Scoring: high=0.4, medium=0.2, low=0.1, cap at 1
  let score = 0;
  for (const f of all) {
    if (f.severity === "high") score += 0.4;
    else if (f.severity === "medium") score += 0.2;
    else score += 0.1;
  }
  score = Math.min(1, Math.round(score * 100) / 100);

  const blocked = all.some((f) => f.severity === "high") || score >= 0.8;
  const flags = Array.from(new Set(all.map((f) => `${f.type}:${f.pattern}`)));

  return { flags, details: all, riskScore: score, blocked };
}

export { DEFAULT_BANNED, PROMO_CLAIM_PATTERNS };
