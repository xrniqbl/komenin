#!/usr/bin/env node
/**
 * AI model health-check — probes every model in the Komenin AI tier allowlists
 * against the configured gateway and reports which names the gateway accepts.
 *
 * Use this BEFORE go-live to confirm the model NAMES in
 * KOMENIN_AI_MODELS_{STARTER,PRO,PRO_MAX} match what your gateway/9Router
 * actually serves (naming differs between providers).
 *
 * Usage:
 *   node scripts/check-ai-models.mjs              # probe all tiers
 *   node scripts/check-ai-models.mjs --tier pro   # one tier only
 *   node scripts/check-ai-models.mjs --timeout 8  # per-model timeout (sec)
 *
 * Reads the gateway from env (AI_GATEWAY_BASE_URL + AI_GATEWAY_API_KEY) and the
 * allowlists from KOMENIN_AI_MODELS_* (or the built-in defaults). Loads
 * .env.local/.env if present. Exits 1 if any probed model fails.
 */

import { readFileSync, existsSync } from "node:fs";

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

// --- args ---
const args = process.argv.slice(2);
const tierArg = args.includes("--tier") ? args[args.indexOf("--tier") + 1] : null;
const timeoutSec = args.includes("--timeout") ? Number(args[args.indexOf("--timeout") + 1]) : 12;

// --- env loading (platform env wins) ---
function loadDotEnv(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m || process.env[m[1]] !== undefined) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    process.env[m[1]] = v;
  }
}
loadDotEnv(".env.local");
loadDotEnv(".env");

// --- defaults (mirror src/lib/ai/models.ts) ---
const ECONOMIC = ["gpt-4o-mini", "deepseek-v3.2", "glm-4.6-flash", "gemini-2.0-flash"];
const STANDARD = ["gpt-4o", "deepseek-v3.2-exp", "kimi-k2", "glm-4.6", "gemini-2.5-flash"];
const PREMIUM = ["o1", "claude-sonnet-4.5", "gemini-2.5-pro", "deepseek-r1"];

function parseList(raw, fallback) {
  if (!raw?.trim()) return fallback;
  return raw.split(",").map((m) => m.trim()).filter(Boolean);
}

const TIERS = {
  starter: parseList(process.env.KOMENIN_AI_MODELS_STARTER, ECONOMIC),
  pro: parseList(process.env.KOMENIN_AI_MODELS_PRO, [...ECONOMIC, ...STANDARD]),
  pro_max: parseList(process.env.KOMENIN_AI_MODELS_PRO_MAX, [...ECONOMIC, ...STANDARD, ...PREMIUM]),
};

const baseUrl = (process.env.AI_GATEWAY_BASE_URL || "").trim().replace(/\/$/, "");
const apiKey = (process.env.AI_GATEWAY_API_KEY || "").trim();

if (!baseUrl) {
  console.error(`${RED}ERROR${RESET}: AI_GATEWAY_BASE_URL is not set. Point it at your gateway.`);
  process.exit(2);
}

const tiersToCheck = tierArg ? [tierArg] : Object.keys(TIERS);
if (tierArg && !TIERS[tierArg]) {
  console.error(`${RED}ERROR${RESET}: unknown tier "${tierArg}" (expected starter|pro|pro_max)`);
  process.exit(2);
}

async function probeModel(model) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutSec * 1000);
  const started = Date.now();
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 4,
        temperature: 0,
      }),
      signal: controller.signal,
    });
    const latencyMs = Date.now() - started;
    const text = await res.text().catch(() => "");
    if (!res.ok) {
      // Try to surface the gateway's error message (often "model not found").
      let msg = `HTTP ${res.status}`;
      try {
        const j = JSON.parse(text);
        if (j?.error?.message) msg = j.error.message;
      } catch {
        if (text) msg = text.slice(0, 120);
      }
      return { ok: false, status: res.status, error: msg, latencyMs };
    }
    return { ok: true, status: res.status, latencyMs };
  } catch (err) {
    const latencyMs = Date.now() - started;
    const msg =
      err?.name === "AbortError"
        ? `timeout after ${timeoutSec}s`
        : err instanceof Error
          ? err.message
          : String(err);
    return { ok: false, status: 0, error: msg, latencyMs };
  } finally {
    clearTimeout(t);
  }
}

console.log(`\nAI model health-check`);
console.log(`Gateway: ${baseUrl} ${apiKey ? "(key set)" : DIM + "(no key)" + RESET}`);
console.log(`${"=".repeat(60)}`);

let totalFailed = 0;
for (const tier of tiersToCheck) {
  const models = [...new Set(TIERS[tier])];
  console.log(`\n${YELLOW}${tier.toUpperCase()}${RESET} (${models.length} models)`);
  // Probe sequentially — cheap, avoids hammering the gateway.
  for (const model of models) {
    const r = await probeModel(model);
    if (r.ok) {
      console.log(`  ${GREEN}✓${RESET} ${model} ${DIM}(${r.latencyMs}ms)${RESET}`);
    } else {
      totalFailed += 1;
      console.log(`  ${RED}✗${RESET} ${model} ${DIM}— ${r.error}${RESET}`);
    }
  }
}

console.log(`\n${"=".repeat(60)}`);
if (totalFailed > 0) {
  console.log(
    `${RED}FAIL${RESET}: ${totalFailed} model(s) not accepted by the gateway.\n` +
      `Fix the names in KOMENIN_AI_MODELS_* (or remove them from the tier) before go-live.\n`,
  );
  process.exit(1);
}
console.log(`${GREEN}PASS${RESET}: every probed model is accepted by the gateway.\n`);
process.exit(0);
