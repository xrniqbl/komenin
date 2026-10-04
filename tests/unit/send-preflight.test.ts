import { describe, expect, it } from "vitest";
import { runSendPreflight } from "@/lib/send-preflight";

describe("runSendPreflight", () => {
  it("blocks empty body", () => {
    const result = runSendPreflight({ body: "   " });
    expect(result.ok).toBe(false);
    expect(result.reasons.some((r) => r.toLowerCase().includes("empty"))).toBe(true);
  });

  it("blocks high-risk banned phrases", () => {
    const result = runSendPreflight({
      body: "Ini judi online terbaik",
    });
    expect(result.blocked).toBe(true);
  });

  it("blocks daily quota exhaustion", () => {
    const result = runSendPreflight({
      body: "Nice post, thanks for sharing!",
      account: {
        status: "healthy",
        healthScore: 90,
        actionsToday: 50,
        dailyQuota: 50,
      },
    });
    expect(result.ok).toBe(false);
    // Bilingual guardrail message: English "daily quota reached (50/50)" token
    // plus Indonesian detail — match either language so the test does not pin
    // a single copy string.
    expect(result.reasons.join(" ")).toMatch(/quota|kuota|batas/i);
  });

  it("blocks duplicate recent bodies", () => {
    const result = runSendPreflight({
      body: "Love this insight",
      recentBodies: ["love this insight"],
    });
    expect(result.ok).toBe(false);
    expect(result.reasons.join(" ")).toMatch(/duplicate/i);
  });

  it("allows a clean healthy send", () => {
    const result = runSendPreflight({
      body: "Thanks for sharing this perspective on product ops.",
      account: {
        status: "healthy",
        healthScore: 88,
        actionsToday: 2,
        dailyQuota: 40,
      },
      monthly: { sendsUsed: 10, sendLimit: 3000 },
    });
    expect(result.ok).toBe(true);
    expect(result.blocked).toBe(false);
  });
});
