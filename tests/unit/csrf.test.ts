import { describe, expect, it } from "vitest";
import { assertSameOrigin } from "@/lib/csrf";

function post(origin?: string, fetchSite?: string): Request {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (origin) headers["origin"] = origin;
  if (fetchSite) headers["sec-fetch-site"] = fetchSite;
  return new Request("https://app.example.com/api/billing/snap", {
    method: "POST",
    headers,
  });
}

describe("assertSameOrigin (CSRF guard)", () => {
  it("allows same-origin requests with matching Origin header", () => {
    expect(assertSameOrigin(post("https://app.example.com"))).toBeNull();
  });

  it("rejects cross-origin Origin header with 403", () => {
    const res = assertSameOrigin(post("https://evil.example"));
    expect(res).not.toBeNull();
    expect(res!.status).toBe(403);
  });

  it("rejects null Origin (sandboxed iframe source)", () => {
    const res = assertSameOrigin(post("null"));
    expect(res).not.toBeNull();
    expect(res!.status).toBe(403);
  });

  it("rejects Sec-Fetch-Site: cross-site without Origin", () => {
    const res = assertSameOrigin(post(undefined, "cross-site"));
    expect(res).not.toBeNull();
    expect(res!.status).toBe(403);
  });

  it("allows Sec-Fetch-Site: same-origin", () => {
    expect(assertSameOrigin(post(undefined, "same-origin"))).toBeNull();
  });

  it("allows server-to-server requests with neither header (curl, cron, webhooks)", () => {
    expect(assertSameOrigin(post())).toBeNull();
  });
});
