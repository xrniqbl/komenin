import { chromium } from "@playwright/test";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const EMAIL = `dbg-${Date.now()}@komenin.id`;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on("pageerror", (e) => console.log("PAGEERROR:", String(e.message).slice(0, 300)));
page.on("console", (m) => {
  if (m.type() === "error") console.log("CONSOLE-ERR:", m.text().slice(0, 300));
});
page.on("response", async (r) => {
  if (r.url().includes("/api/auth/email/request")) {
    console.log("OTP API:", r.status(), (await r.text()).slice(0, 300));
  }
});

await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.getByRole("textbox", { name: "Email" }).fill(EMAIL);
await page.getByRole("button", { name: "Send sign-in code" }).click();
await page.waitForTimeout(16000);
const body = await page.evaluate(() => document.body.innerText.slice(0, 1500));
console.log("BODY:\n" + body);
await browser.close();
