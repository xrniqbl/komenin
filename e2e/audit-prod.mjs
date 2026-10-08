import { chromium } from "@playwright/test";

const BASE = "http://localhost:3100";
const EMAIL = `audit-${Date.now()}@komenin.id`;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push("PAGEERROR: " + String(e.message).slice(0, 300)));
page.on("console", (m) => {
  if (m.type() === "error" && !m.text().includes("favicon")) errors.push("CONSOLE: " + m.text().slice(0, 300));
});

console.log("STEP 1: open /login");
await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.getByRole("textbox", { name: "Email" }).fill(EMAIL);
await page.getByRole("button", { name: "Send sign-in code" }).click();
console.log("STEP 2: waiting for code stage...");
await page.waitForSelector("#otp-code", { timeout: 30000 });
const msg = await page.evaluate(() => document.body.innerText.slice(0, 500));
console.log("CODE STAGE MSG:", msg.match(/Mode dev[^\n]*/)?.[0] || msg.slice(0, 200));
const code = (msg.match(/(\d{6})/) || [])[1];
if (!code) throw new Error("no 6-digit code found");

console.log("STEP 3: submit code", code);
await page.getByPlaceholder("••••••").fill(code);
await page.getByRole("button", { name: /Masuk|Sign in/i }).click();
await page.waitForURL("**/onboarding", { timeout: 20000 });
console.log("STEP 4: onboarding reached:", page.url());
console.log("ERRORS SO FAR:", errors.length ? errors : "none");

console.log("STEP 5: click Get started");
await page.getByRole("button", { name: "Get started" }).click();
await page.waitForSelector("text=Create your workspace", { timeout: 10000 });
console.log("STEP 6: workspace step OK");

await page.locator("#onboarding-name").fill("Audit Workspace");
await page.getByRole("button", { name: "Continue" }).click();
await page.waitForSelector("text=What are your goals?", { timeout: 10000 });
console.log("STEP 8: goals step OK");

await page.getByRole("button", { name: /Boost Engagement/ }).click();
await page.getByRole("button", { name: "Instagram" }).click();
await page.getByRole("button", { name: "Continue" }).click();
await page.waitForSelector("text=Pick a campaign template", { timeout: 10000 });
console.log("STEP 10: template step OK");

await page.getByRole("button", { name: "Continue" }).click();
await page.waitForSelector("text=Ready to launch!", { timeout: 10000 });
console.log("STEP 12: launch step OK");

await page.getByRole("button", { name: "Launch command center" }).click();
await page.waitForURL("**/app", { timeout: 20000 });
console.log("STEP 14: dashboard reached:", page.url());
await page.waitForSelector("text=Command Center", { timeout: 15000 });
console.log("DASHBOARD OK");
console.log("PAGE ERRORS:", errors.length ? errors : "none");
await browser.close();
console.log("AUDIT-FLOW-PASS email=" + EMAIL);
