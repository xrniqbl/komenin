/**
 * Product smoke checks for critical Aether paths (no live network side effects).
 * Usage: npx tsx scripts/smoke-product.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { billingPlans } from "../src/data/pricing";
import {
  FREE_ENTITLEMENTS,
  getEntitlementsForPlanCode,
  planCodeFromMarketingId,
} from "../src/lib/billing/entitlements";
import { DEFAULT_PLANS } from "../src/lib/billing/catalog";
import { contactPayloadSchema } from "../src/lib/contact";
import { FEATURE_FLAG_KEYS } from "../src/lib/feature-flags";
import { evaluateLiveReadiness } from "../src/lib/runtime-mode";
import { runSendPreflight } from "../src/lib/send-preflight";
import { evaluateSsoReadiness } from "../src/lib/sso-readiness";
import { SCOPES } from "../src/lib/api-keys";

function loadEnvFile(filePath: string) {
  if (!existsSync(filePath)) return;
  const text = readFileSync(filePath, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    if (!key || process.env[key] !== undefined) continue;
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadEnvFile(resolve(process.cwd(), ".env"));
loadEnvFile(resolve(process.cwd(), ".env.local"));

type Check = { name: string; ok: boolean; detail?: string };

const checks: Check[] = [];

function check(name: string, ok: boolean, detail?: string) {
  checks.push({ name, ok, detail });
}

// Pricing truth
check(
  "marketing plans are IDR",
  billingPlans.every((p) => p.currency === "IDR"),
);
check(
  "catalog totals match marketing",
  billingPlans.map((p) => p.priceTotal).join(",") ===
    DEFAULT_PLANS.map((p) => p.priceIdr).join(","),
  billingPlans.map((p) => p.priceTotal).join(" / "),
);
check(
  "entitlements map 1m/6m/12m",
  planCodeFromMarketingId("1m") === "starter_1m" &&
    planCodeFromMarketingId("6m") === "growth_6m" &&
    planCodeFromMarketingId("12m") === "scale_12m",
);
check(
  "free tier account cap is 3",
  FREE_ENTITLEMENTS.maxSocialAccounts === 3 &&
    getEntitlementsForPlanCode("free").maxSocialAccounts === 3,
);

// Contact schema
check(
  "contact schema accepts valid lead",
  contactPayloadSchema.safeParse({
    name: "Ops",
    email: "ops@brand.com",
    message: "Need enterprise demo for 40 accounts",
  }).success,
);
check(
  "contact schema rejects short message",
  !contactPayloadSchema.safeParse({
    name: "Ops",
    email: "ops@brand.com",
    message: "hi",
  }).success,
);

// Preflight
check(
  "preflight blocks empty body",
  runSendPreflight({ body: " " }).blocked,
);
check(
  "preflight allows clean comment",
  runSendPreflight({
    body: "Thanks for sharing this product ops write-up.",
    account: { status: "healthy", healthScore: 90, actionsToday: 1, dailyQuota: 40 },
  }).ok,
);

// Live + SSO readiness helpers
const live = evaluateLiveReadiness();
check("live readiness returns mode", live.mode === "simulator" || live.mode === "live", live.mode);
const sso = evaluateSsoReadiness({ isProduction: true });
check("SSO not production-ready", sso.readyForProductionLogin === false);

// API scopes / flags
check(
  "leads scopes registered",
  SCOPES.includes("leads:read") && SCOPES.includes("leads:write"),
);
check(
  "feature flag keys present",
  Boolean(
    FEATURE_FLAG_KEYS.contactForm &&
      FEATURE_FLAG_KEYS.publicApiWrite &&
      FEATURE_FLAG_KEYS.leadCapture &&
      FEATURE_FLAG_KEYS.agencyClients,
  ),
);

const failed = checks.filter((c) => !c.ok);
for (const c of checks) {
  const mark = c.ok ? "PASS" : "FAIL";
  console.log(`${mark}  ${c.name}${c.detail ? ` — ${c.detail}` : ""}`);
}

if (failed.length) {
  console.error(`\n${failed.length}/${checks.length} product smoke checks failed`);
  process.exit(1);
}

console.log(`\nAll ${checks.length} product smoke checks passed`);
