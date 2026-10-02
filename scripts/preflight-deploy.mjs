#!/usr/bin/env node
/**
 * Pre-flight deploy checker — validates every environment variable the app
 * needs BEFORE you promote a build to production. Fails (exit 1) on any
 * missing/invalid required var so a bad deploy never reaches users.
 *
 * Usage:
 *   node scripts/preflight-deploy.mjs            # check current env
 *   node scripts/preflight-deploy.mjs --strict   # also require recommended vars
 *
 * It reads from process.env (already loaded by your platform) — never prints
 * secret VALUES, only names + ok/missing status.
 */

const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

const strict = process.argv.includes("--strict");

// Load .env.local / .env if present (platform env always wins). No dependency —
// a tiny parser so this script runs anywhere without `npm install dotenv`.
import { readFileSync, existsSync } from "node:fs";
function loadDotEnv(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    if (process.env[m[1]] !== undefined) continue; // platform env wins
    let val = m[2];
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    process.env[m[1]] = val;
  }
}
loadDotEnv(".env.local");
loadDotEnv(".env");

/** @typedef {{ name: string, required: boolean, note?: string, validate?: (v: string) => true | string }} Check */

/** @type {Check[]} */
const CHECKS = [
  // --- Core runtime ---
  { name: "DATABASE_URL", required: true },
  {
    name: "DIRECT_DATABASE_URL",
    required: true,
    validate: (v) => {
      const poolerUrl = process.env.DATABASE_URL?.trim();
      if (poolerUrl && v === poolerUrl) {
        return "must differ from DATABASE_URL (use the direct non-pooler endpoint) — migrations through PgBouncer can strand the advisory lock (P1002)";
      }
      return true;
    },
  },
  {
    name: "AUTH_SECRET",
    required: true,
    validate: (v) => (v.length >= 16 ? true : "must be ≥16 chars (use 32+)"),
  },
  {
    name: "APP_URL",
    required: true,
    validate: (v) =>
      /^https:\/\//.test(v) ? true : "must be an https:// origin in production",
  },
  {
    name: "ENCRYPTION_KEY",
    required: true,
    validate: (v) => {
      if (!/^[0-9a-fA-F]{64}$/.test(v)) return "must be exactly 64 hex characters";
      // Reject guessable keys: a sequential or single-char key is effectively
      // plaintext for anyone who has ever seen the repo/deploy bundle.
      const collapsed = v.toLowerCase();
      const uniqueChars = new Set(collapsed).size;
      if (uniqueChars <= 4) {
        return "too low entropy (≤4 distinct characters) — generate with: openssl rand -hex 32";
      }
      for (let i = 1; i < collapsed.length; i += 1) {
        const code = collapsed.charCodeAt(i);
        const prev = collapsed.charCodeAt(i - 1);
        const isHexForward = code === prev + 1 || (prev === 57 && code === 97); // 9→a
        const isHexBackward = code === prev - 1 || (prev === 97 && code === 57); // a→9
        if (isHexForward || isHexBackward) {
          return "looks like a sequential pattern — generate with: openssl rand -hex 32";
        }
      }
      return true;
    },
  },
  {
    name: "SIMULATOR_MODE",
    required: true,
    validate: (v) =>
      v === "false" ? true : "must be \"false\" in production (no simulator payloads)",
  },
  {
    name: "WORKER_SECRET",
    required: true,
    validate: (v) => (v.length >= 16 ? true : "must be ≥16 chars"),
  },
  {
    name: "CRON_SECRET",
    required: true,
    note: "Vercel Cron auth",
    validate: (v) => (v.length >= 16 ? true : "must be ≥16 chars"),
  },

  // --- Billing / Midtrans ---
  {
    name: "MIDTRANS_IS_PRODUCTION",
    required: true,
    validate: (v) =>
      v === "true" ? true : "must be \"true\" for live payments (sandbox otherwise)",
  },
  {
    name: "MIDTRANS_SERVER_KEY",
    required: true,
    validate: (v) =>
      v.startsWith("Mid-server-")
        ? true
        : "looks like a sandbox key (expected \"Mid-server-...\" in production)",
  },
  {
    name: "MIDTRANS_CLIENT_KEY",
    required: true,
    validate: (v) =>
      v.startsWith("Mid-client-")
        ? true
        : "looks like a sandbox key (expected \"Mid-client-...\" in production)",
  },

  // --- Durable rate limiting (fail-closed auth denies traffic on limiter outage) ---
  {
    name: "UPSTASH_REDIS_REST_URL",
    required: true,
    note: "durable rate limit; fail-closed auth surfaces deny traffic without it",
  },
  { name: "UPSTASH_REDIS_REST_TOKEN", required: true },

  // --- Social bridge (production gate fails closed on self-URL) ---
  {
    name: "SOCIAL_PUBLISH_WEBHOOK_URL",
    required: true,
    validate: (v) => {
      if (!/^https:\/\//.test(v)) return "must be an https:// external bridge URL";
      const appUrl = (process.env.APP_URL || "").replace(/\/$/, "");
      if (appUrl && v.startsWith(appUrl))
        return "must be EXTERNAL (not this app's own /api/publish/webhook)";
      return true;
    },
  },
  {
    name: "SOCIAL_PUBLISH_WEBHOOK_TOKEN",
    required: true,
    validate: (v) => (v.length >= 16 ? true : "must be ≥16 chars"),
  },

  // --- Komenin AI monetization ---
  {
    name: "AI_RATE_LIMIT_PER_MIN",
    required: false,
    note: "clamped to [1,600]; default 60",
  },
  {
    name: "AI_MODEL_COST_IDR",
    required: strict,
    note: "upstream cost per model — required for accurate admin margin",
    validate: (v) => {
      try {
        const o = JSON.parse(v);
        return o && typeof o === "object" && !Array.isArray(o)
          ? true
          : "must be a JSON object map";
      } catch {
        return "must be valid JSON";
      }
    },
  },
  { name: "KOMENIN_AI_MODELS_STARTER", required: false, note: "defaults exist" },
  { name: "KOMENIN_AI_MODELS_PRO", required: false },
  { name: "KOMENIN_AI_MODELS_PRO_MAX", required: false },

  // --- API key hashing pepper (required — bare sha256 without it) ---
  {
    name: "API_KEY_PEPPER",
    required: true,
    note: "HMAC pepper for hashed API keys",
    validate: (v) => (v.length >= 16 ? true : "must be ≥16 chars"),
  },
  // --- OAuth/SSO MAC secrets (no AUTH_SECRET fallback in production) ---
  {
    name: "OAUTH_STATE_SECRET",
    required: true,
    note: "HMAC for OAuth state; production refuses AUTH_SECRET fallback",
    validate: (v) => (v.length >= 16 ? true : "must be ≥16 chars"),
  },
  {
    name: "SSO_TICKET_SECRET",
    required: true,
    note: "HMAC for SSO tickets; production refuses AUTH_SECRET fallback",
    validate: (v) => (v.length >= 16 ? true : "must be ≥16 chars"),
  },

  // --- AI gateway transport (plaintext HTTP leaks the API key on the wire) ---
  {
    name: "AI_GATEWAY_BASE_URL",
    required: false,
    validate: (v) =>
      /^https:\/\//.test(v)
        ? true
        : "must be an https:// URL — an API key sent over plaintext HTTP to a bare IP can be intercepted (MITM)",
  },

  // --- OAuth connectors (optional per platform) ---
  { name: "INSTAGRAM_APP_ID", required: false, note: "Instagram OAuth" },
  { name: "INSTAGRAM_APP_SECRET", required: false },
  { name: "THREADS_APP_ID", required: false },
  { name: "THREADS_APP_SECRET", required: false },
  { name: "TIKTOK_CLIENT_KEY", required: false },
  { name: "TIKTOK_CLIENT_SECRET", required: false },

  // --- Email (REQUIRED for OTP login + digest/threshold emails) ---
  {
    name: "BREVO_API_KEY",
    required: true,
    note: "email OTP login + digest/threshold emails silently fail without it",
    validate: (v) =>
      v.startsWith("xkeysib-") ? true : "expected a Brevo key (\"xkeysib-...\")",
  },
  {
    name: "EMAIL_FROM",
    required: true,
    note: "sender address for OTP/digest emails, e.g. \"Komenin <noreply@komenin.id>\"",
    validate: (v) => /@/.test(v) ? true : "must contain a sender email address",
  },
];

let failures = 0;
let warnings = 0;

console.log(`\nPre-flight deploy check ${strict ? "(strict)" : ""}\n${"=".repeat(46)}`);

for (const check of CHECKS) {
  const raw = process.env[check.name];
  const present = typeof raw === "string" && raw.trim().length > 0;

  if (!present) {
    if (check.required) {
      failures += 1;
      console.log(`${RED}✗ MISSING${RESET}  ${check.name}${check.note ? DIM + ` — ${check.note}` + RESET : ""}`);
    } else {
      if (strict) warnings += 1;
      console.log(`${DIM}○ optional${RESET} ${check.name}${check.note ? DIM + ` — ${check.note}` + RESET : ""}`);
    }
    continue;
  }

  const verdict = check.validate ? check.validate(raw.trim()) : true;
  if (verdict === true) {
    console.log(`${GREEN}✓ ok${RESET}      ${check.name}`);
  } else {
    if (check.required) {
      failures += 1;
      console.log(`${RED}✗ INVALID${RESET}  ${check.name}: ${verdict}`);
    } else {
      warnings += 1;
      console.log(`${YELLOW}⚠ warn${RESET}    ${check.name}: ${verdict}`);
    }
  }
}

console.log("=".repeat(46));
if (failures > 0) {
  console.log(`${RED}FAIL${RESET}: ${failures} required check(s) failed, ${warnings} warning(s). Do NOT deploy.\n`);
  process.exit(1);
}
console.log(
  `${GREEN}PASS${RESET}: all required checks ok${warnings ? ` (${YELLOW}${warnings} warning(s)${RESET})` : ""}. Safe to deploy.\n`,
);
process.exit(0);
