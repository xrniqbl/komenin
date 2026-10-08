#!/usr/bin/env node
/**
 * Pre-flight deploy checker — validates every environment variable the app
 * needs BEFORE you promote a build to production. Fails (exit 1) on any
 * missing/invalid required var so a bad deploy never reaches users.
 *
 * Usage:
 *   node scripts/preflight-deploy.mjs              # check current env
 *   node scripts/preflight-deploy.mjs --strict     # also require recommended vars
 *   node scripts/preflight-deploy.mjs --self-test  # validate the CHECKS logic
 *     itself with synthetic env (used in CI; never touches real secrets)
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
import { randomBytes } from "node:crypto";
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
  {
    name: "DIRECT_DATABASE_URL",
    required: true,
    note: "direct non-pooler endpoint for migrations (PgBouncer strands the advisory lock)",
    validate: (v) => {
      if (/-pooler[.-]/.test(v))
        return "looks like a -pooler endpoint — use the direct endpoint for migrations";
      const poolerUrl = (process.env.DATABASE_URL || "").trim();
      // Neon/Vercel: pooler vs direct must differ (migrations through PgBouncer
      // strand the advisory lock P1002). Self-hosted Docker Postgres (@db,
      // no pooler) has no PgBouncer in the path, so an identical URL is safe.
      if (poolerUrl && v.trim() === poolerUrl && /-pooler[.-]/.test(poolerUrl))
        return "must differ from DATABASE_URL (use the direct non-pooler endpoint) — migrations through PgBouncer can strand the advisory lock (P1002)";
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
    name: "AUTH_URL",
    required: true,
    note: "must equal APP_URL (Auth.js no longer trusts Host in production)",
    validate: (v) => {
      if (!/^https:\/\//.test(v)) return "must be an https:// origin in production";
      const appUrl = (process.env.APP_URL || "").trim();
      if (appUrl && v.trim() !== appUrl)
        return "must equal APP_URL — OAuth callbacks need one canonical origin";
      return true;
    },
  },
  {
    name: "ENCRYPTION_KEY",
    required: true,
    validate: (v) => {
      if (!/^[0-9a-fA-F]{64}$/.test(v)) return "must be exactly 64 hex characters";
      // Reject guessable keys: an all-same/low-diversity key is effectively
      // plaintext for anyone who has ever seen the repo/deploy bundle (this
      // also rejects the "000…0" CI/build placeholder).
      const collapsed = v.toLowerCase();
      const uniqueChars = new Set(collapsed).size;
      if (uniqueChars <= 4) {
        return "too low entropy (≤4 distinct characters) — generate with: openssl rand -hex 32";
      }
      // Reject a whole key built from one short repeating block (e.g. "ab".repeat(32)).
      if (/^(.{1,8})\1{3,}$/.test(collapsed)) {
        return "looks like a repeating pattern — generate with: openssl rand -hex 32";
      }
      // Reject long sequential runs in hex order (0-9a-f cyclic). The threshold
      // is a RUN of 8+ steps, not any single adjacent pair: a random 64-hex key
      // contains an adjacent sequential pair ~99.97% of the time, but a run of
      // 8+ has probability ≈ 63×(1/8)⁷ ≈ 3e-5, so only deliberate sequences
      // ("0123456789abcdef…") trip this.
      const order = "0123456789abcdef";
      const pos = (c) => order.indexOf(c);
      let best = 1;
      let run = 1;
      let dir = 0;
      for (let i = 1; i < collapsed.length; i += 1) {
        const step = (((pos(collapsed[i]) - pos(collapsed[i - 1])) % 16) + 16) % 16;
        const s = step === 1 ? 1 : step === 15 ? -1 : 0;
        if (s !== 0 && s === dir) {
          run += 1;
        } else if (s !== 0) {
          dir = s;
          run = 2;
        } else {
          dir = 0;
          run = 1;
        }
        if (run > best) best = run;
      }
      if (best >= 8) {
        return "looks like a sequential pattern — generate with: openssl rand -hex 32";
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
    note: "external scheduler auth",
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
  // --- SSO/SAML kill-switches (signature validation unimplemented, ACS 501) ---
  {
    name: "SSO_ENFORCE_LOGIN",
    required: false,
    note: "must NOT be true in production until signed SAML ACS ships",
    validate: (v) =>
      v === "true"
        ? "SSO_ENFORCE_LOGIN=true is not allowed in production — SAML ACS returns 501"
        : true,
  },
  {
    name: "SAML_ALLOW_UNSIGNED",
    required: false,
    note: "never allowed in production",
    validate: (v) =>
      v === "true" ? "SAML_ALLOW_UNSIGNED=true is never allowed in production" : true,
  },
  {
    name: "ALLOW_SECURITY_STUBS",
    required: false,
    note: "never allowed in production",
    validate: (v) =>
      v === "true" ? "ALLOW_SECURITY_STUBS=true is never allowed in production" : true,
  },
  {
    name: "DATABASE_URL",
    required: true,
    note: "Neon pooler endpoints need connection_limit (warn-only check)",
    validate: (v) => {
      if (/-pooler[.-]/.test(v) && !/[?&]connection_limit=\d+/.test(v)) {
        // Warn-only: a pooler URL without connection_limit is not fatal.
        console.log(
          `${YELLOW}⚠ warn${RESET}    DATABASE_URL: Neon pooler URL without connection_limit — append ?connection_limit=5&pool_timeout=20`,
        );
      }
      return true;
    },
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

  // --- Database backups (unencrypted dumps hold every secret in plaintext) ---
  {
    name: "BACKUP_ENCRYPTION_KEY",
    required: false,
    note: "AES-256 for dumps (or set BACKUP_PLAINTEXT_OK=true to acknowledge plaintext backups)",
    validate: (v) =>
      /^[0-9a-fA-F]{64}$/.test(v)
        ? true
        : "must be 64 hex characters (openssl rand -hex 32)",
  },
];

let failures = 0;
let warnings = 0;

if (process.argv.includes("--self-test")) {
  runSelfTest();
}

function runSelfTest() {
  // Exercises the CHECKS validators with synthetic values only — no real env
  // is read or printed. Guards against regressions like an over-strict
  // ENCRYPTION_KEY pattern that rejects genuine random keys.
  let failed = 0;
  const assert = (label, actual, expected) => {
    const ok = actual === expected;
    console.log(`${ok ? GREEN + "✓" : RED + "✗"} self-test${RESET} ${label}`);
    if (!ok) {
      failed += 1;
      console.log(`  expected ${expected}, got ${JSON.stringify(actual)}`);
    }
  };
  const check = (name) => CHECKS.find((c) => c.name === name);

  // 10 genuine random keys must all pass.
  let randomPass = 0;
  for (let i = 0; i < 10; i += 1) {
    if (check("ENCRYPTION_KEY").validate(randomBytes(32).toString("hex")) === true) randomPass += 1;
  }
  assert("ENCRYPTION_KEY accepts 10/10 random keys", randomPass, 10);
  // Known-bad keys must fail.
  assert("ENCRYPTION_KEY rejects all-zero", check("ENCRYPTION_KEY").validate("0".repeat(64)) !== true, true);
  assert(
    "ENCRYPTION_KEY rejects sequential",
    check("ENCRYPTION_KEY").validate("0123456789abcdef".repeat(4)) !== true,
    true,
  );
  // AUTH_URL must equal APP_URL.
  process.env.APP_URL = "https://app.example.com";
  assert("AUTH_URL accepts matching origin", check("AUTH_URL").validate("https://app.example.com"), true);
  assert("AUTH_URL rejects different origin", check("AUTH_URL").validate("https://other.example.com") !== true, true);
  // SSO kill-switches must trip.
  assert("SSO_ENFORCE_LOGIN=true trips", check("SSO_ENFORCE_LOGIN").validate("true") !== true, true);
  assert("SSO_ENFORCE_LOGIN=false passes", check("SSO_ENFORCE_LOGIN").validate("false"), true);
  // DIRECT_DATABASE_URL must not be a pooler host.
  assert(
    "DIRECT_DATABASE_URL rejects pooler",
    check("DIRECT_DATABASE_URL").validate("postgresql://u:p@ep-x-pooler.aws.neon.tech:5432/db") !== true,
    true,
  );
  assert(
    "DIRECT_DATABASE_URL accepts direct",
    check("DIRECT_DATABASE_URL").validate("postgresql://u:p@ep-x.aws.neon.tech:5432/db"),
    true,
  );
  // Self-hosted Docker Postgres (@db, no pooler): identical URLs are safe
  // (no PgBouncer in the path), so the validator must accept them.
  process.env.DATABASE_URL = "postgresql://komenin:pw@db:5432/komenin?schema=public";
  assert(
    "DIRECT_DATABASE_URL accepts identical non-pooler (docker)",
    check("DIRECT_DATABASE_URL").validate("postgresql://komenin:pw@db:5432/komenin?schema=public"),
    true,
  );
  // On a pooled endpoint, identical URLs must still fail.
  process.env.DATABASE_URL = "postgresql://u:p@ep-x-pooler.aws.neon.tech:5432/db";
  assert(
    "DIRECT_DATABASE_URL rejects identical pooler",
    check("DIRECT_DATABASE_URL").validate("postgresql://u:p@ep-x-pooler.aws.neon.tech:5432/db") !== true,
    true,
  );
  delete process.env.DATABASE_URL;
  delete process.env.APP_URL;

  if (failed > 0) {
    console.log(`${RED}SELF-TEST FAIL${RESET}: ${failed} assertion(s) failed.\n`);
    process.exit(1);
  }
  console.log(`${GREEN}SELF-TEST PASS${RESET}: preflight validators behave.\n`);
  process.exit(0);
}

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
