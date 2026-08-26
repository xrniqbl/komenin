import { describe, expect, it } from "vitest";
import {
  consumeRateLimit,
  consumeRateLimitMemory,
  extractClientIp,
  getRequestRateKey,
} from "@/lib/rate-limit";

describe("rate-limit", () => {
  it("allows traffic under the limit and blocks after", () => {
    const key = `test:${Date.now()}:${Math.random()}`;
    const first = consumeRateLimitMemory({ key, limit: 2, windowMs: 60_000 });
    const second = consumeRateLimitMemory({ key, limit: 2, windowMs: 60_000 });
    const third = consumeRateLimitMemory({ key, limit: 2, windowMs: 60_000 });
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(third.ok).toBe(false);
    expect(third.remaining).toBe(0);
    expect(first.backend).toBe("memory");
  });

  it("async consumeRateLimit falls back to memory when Upstash is unset", async () => {
    const key = `test-async:${Date.now()}:${Math.random()}`;
    const first = await consumeRateLimit({ key, limit: 1, windowMs: 60_000 });
    const second = await consumeRateLimit({ key, limit: 1, windowMs: 60_000 });
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(false);
    expect(first.backend).toBe("memory");
  });

  it("prefers platform-trusted headers over X-Forwarded-For", () => {
    const request = new Request("https://example.com", {
      headers: {
        "x-vercel-forwarded-for": "203.0.113.50",
        "x-forwarded-for": "1.2.3.4",
      },
    });
    expect(extractClientIp(request)).toBe("203.0.113.50");
  });

  it("prefers right-most public X-Forwarded-For hop", () => {
    const request = new Request("https://example.com", {
      headers: {
        "x-forwarded-for": "1.2.3.4, 10.0.0.1, 203.0.113.9",
      },
    });
    expect(extractClientIp(request)).toBe("203.0.113.9");
    expect(getRequestRateKey(request, "api:test")).toBe("api:test:ip:203.0.113.9");
  });

  it("does not key rate limit on authorization header material", () => {
    const request = new Request("https://example.com", {
      headers: {
        authorization: "Bearer super-secret-token-value",
        "x-forwarded-for": "198.51.100.10",
      },
    });
    expect(getRequestRateKey(request, "api:v1")).toBe("api:v1:ip:198.51.100.10");
  });
});
