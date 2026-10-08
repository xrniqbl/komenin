import { chromium } from "@playwright/test";

// Audit every /app/* + /admin + /onboarding route: status, key heading, error markers.
const BASE = "http://localhost:3000";
const EMAIL = `feat-audit-${Date.now()}@komenin.id`;

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();
const page = await ctx.newPage();

// --- login via OTP (with retry on IP rate-limit) ---
await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.getByRole("textbox", { name: "Email" }).fill(EMAIL);
let otpResp = null;
page.on("response", async (r) => {
  if (r.url().includes("/api/auth/email/request")) {
    otpResp = { status: r.status(), body: (await r.text()).slice(0, 200) };
  }
});
await page.getByRole("button", { name: "Send sign-in code" }).click();
for (let attempt = 1; attempt <= 4; attempt++) {
  try {
    await page.waitForSelector("#otp-code", { timeout: 30000 });
    break;
  } catch {
    console.log(`OTP attempt ${attempt} no code stage; last API:`, JSON.stringify(otpResp));
    if (attempt === 4) throw new Error("OTP code stage never appeared");
    await page.waitForTimeout(65000); // IP budget is 10/min
    otpResp = null;
    await page.getByRole("button", { name: "Send sign-in code" }).click();
  }
}
const msg = await page.evaluate(() => document.body.innerText);
const code = (msg.match(/(\d{6})/) || [])[1];
await page.getByPlaceholder("••••••").fill(code);
await page.getByRole("button", { name: /Masuk|Sign in/i }).click();
await page.waitForURL("**/onboarding", { timeout: 20000 });

// --- onboarding quick path ---
await page.getByRole("button", { name: "Get started" }).click();
await page.waitForSelector("text=Create your workspace", { timeout: 10000 });
await page.locator("#onboarding-name").fill("Feature Audit WS");
await page.getByRole("button", { name: "Continue" }).click();
await page.waitForSelector("text=What are your goals?", { timeout: 10000 });
await page.getByRole("button", { name: /Boost Engagement/ }).click();
await page.getByRole("button", { name: "Instagram" }).click();
await page.getByRole("button", { name: "Continue" }).click();
await page.waitForSelector("text=Pick a campaign template", { timeout: 10000 });
await page.getByRole("button", { name: "Continue" }).click();
await page.waitForSelector("text=Ready to launch!", { timeout: 10000 });
await page.getByRole("button", { name: "Launch command center" }).click();
await page.waitForURL("**/app", { timeout: 20000 });
console.log("SETUP OK, session established");

const routes = [
  "/app", "/app/accounts", "/app/accounts/new", "/app/campaigns", "/app/campaigns/new",
  "/app/approvals", "/app/content", "/app/content/new", "/app/inbox", "/app/mentions",
  "/app/leads", "/app/listeners", "/app/sessions", "/app/proxies", "/app/proxies/new",
  "/app/skills", "/app/agents", "/app/agents/new", "/app/runs", "/app/activity",
  "/app/analytics", "/app/audit-logs", "/app/templates", "/app/templates/new",
  "/app/clients", "/app/competitors", "/app/notifications", "/app/support",
  "/app/support/new", "/app/checkout", "/app/settings", "/app/settings/general",
  "/app/settings/billing", "/app/settings/publisher", "/app/settings/risk-rules",
  "/app/settings/security", "/app/settings/team", "/app/settings/webhooks",
  "/app/settings/api-keys", "/app/settings/ai",
  "/admin", "/admin/users", "/admin/workspaces", "/admin/billing", "/admin/connectors",
  "/admin/jobs", "/admin/audit", "/admin/flags", "/admin/regions", "/admin/sso",
  "/admin/support", "/admin/ai", "/admin/vouchers",
  "/onboarding", "/invite/xxxx-invalid",
];

for (const r of routes) {
  const errs = [];
  const onErr = (e) => errs.push(String(e.message).slice(0, 120));
  page.on("pageerror", onErr);
  let status = 0, heading = "", note = "";
  try {
    const resp = await page.goto(`${BASE}${r}`, { waitUntil: "domcontentloaded", timeout: 30000 });
    status = resp?.status() ?? 0;
    await page.waitForTimeout(4000); // pacing: avoid Neon pool exhaustion
    const text = await page.evaluate(() => document.body.innerText.slice(0, 3000));
    const h = await page.evaluate(() => document.querySelector("h1")?.textContent?.trim()?.slice(0, 80) || "");
    heading = h;
    if (/something went wrong|application error|digest/i.test(text.slice(0, 500))) note = "ERROR-BOUNDARY?";
    else if (/not found|404/i.test(h)) note = "NOT-FOUND?";
    else if (/sign in|log in/i.test(text.slice(0, 300)) && status === 200) note = "REDIRECT-TO-LOGIN?";
    if (errs.length) note += (note ? " " : "") + "JS:" + errs[0];
  } catch (e) {
    note = "NAV-FAIL:" + String(e.message).slice(0, 120);
  }
  page.removeListener("pageerror", onErr);
  console.log(`${status}\t${r}\t${heading}\t${note}`);
}

await browser.close();
console.log("FEATURE-AUDIT-DONE email=" + EMAIL);
