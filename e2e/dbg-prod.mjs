import { chromium } from "@playwright/test";

const BASE = "http://localhost:3100";
const EMAIL = `dbg2-${Date.now()}@komenin.id`;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on("pageerror", (e) => console.log("PAGEERROR:", String(e.message).slice(0, 400)));
page.on("console", (m) => {
  if (m.type() === "error") console.log("CONSOLE-ERR:", m.text().slice(0, 400));
});
page.on("response", async (r) => {
  if (r.url().includes("/api/auth/email/request")) {
    console.log("OTP API:", r.status(), (await r.text()).slice(0, 500));
  }
});

await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(3000);
await page.getByRole("textbox", { name: "Email" }).fill(EMAIL);
await page.getByRole("button", { name: "Send sign-in code" }).click();
await page.waitForTimeout(18000);
const body = await page.evaluate(() => document.body.innerText.slice(0, 2000));
console.log("BODY:\n" + body);
await browser.close();
