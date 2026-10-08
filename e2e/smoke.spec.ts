import { expect, test } from "@playwright/test";

test.describe("public smoke", () => {
  test("liveness probe responds ok", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, service: "komenin" });
  });

  test("homepage renders with a single h1 and no console errors", async ({ page }) => {
    const errors: string[] = [];
    // Next.js dev mode emits internal noise that is not an app bug.
    const ignoredPatterns = [/Expected a request ID.*self\.__next_r/];
    page.on("pageerror", (err) => {
      if (!ignoredPatterns.some((p) => p.test(err.message))) {
        errors.push(err.message);
      }
    });

    const res = await page.goto("/");
    expect(res?.status()).toBeLessThan(400);
    await expect(page).toHaveTitle(/.+/);
    await expect(page.locator("h1")).toHaveCount(1);
    expect(errors).toEqual([]);
  });

  test("robots.txt and sitemap.xml are served", async ({ request }) => {
    const robots = await request.get("/robots.txt");
    expect(robots.status()).toBe(200);
    expect(await robots.text()).toMatch(/user-agent/i);

    const sitemap = await request.get("/sitemap.xml");
    expect(sitemap.status()).toBe(200);
    expect(await sitemap.text()).toContain("<urlset");
  });

  test("unauthenticated visitors cannot open the app area", async ({ page }) => {
    await page.goto("/app");
    expect(new URL(page.url()).pathname).not.toBe("/app");
  });
});
