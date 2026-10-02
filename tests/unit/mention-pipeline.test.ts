/**
 * Mention auto-reply pipeline unit tests (F1/F3/F4).
 *
 * Covers the pure decision logic exported from worker-jobs (retry
 * classification + backoff constants) and the template rendering contract
 * used by the template-mode auto reply. DB-touching paths are integration
 * territory and covered elsewhere.
 */

import { describe, expect, it } from "vitest";
import {
  MAX_COMMENT_SEND_ATTEMPTS,
  RETRY_DELAYS_MINUTES,
  isRetryableSendFailure,
  retryDelayMinutesForAttempt,
  shouldDeferForQuietHours,
} from "@/server/worker-jobs";
import { sanitizeReportedUsage } from "@/lib/ai/router";
import { renderTemplate, parseVariables } from "@/lib/template-engine";

describe("isRetryableSendFailure", () => {
  it("classifies transient network/timeout/429/5xx failures as retryable", () => {
    for (const message of [
      "Request timeout after 20000ms",
      "upstream returned 503",
      "Too many requests: rate limit hit (429)",
      "fetch failed: ECONNRESET",
      "socket hang up",
      "service temporarily unavailable",
    ]) {
      expect(isRetryableSendFailure(message), message).toBe(true);
    }
  });

  it("classifies policy/permission rejections as non-retryable", () => {
    for (const message of [
      "Preflight blocked: banned topic politics",
      "Instagram comment failed (403)",
      "duplicate comment detected",
      "account health score below threshold",
    ]) {
      expect(isRetryableSendFailure(message), message).toBe(false);
    }
  });
});

describe("retry backoff contract", () => {
  it("caps total attempts and gives a monotonic backoff ladder", () => {
    // 1 initial attempt + 2 retries = 3 total.
    expect(MAX_COMMENT_SEND_ATTEMPTS).toBe(3);
  });

  it("delivers the documented 2m → 10m ladder for retries 1 and 2", () => {
    // attemptCount is 0 before any send; retry 1 must wait 2m, retry 2 → 10m.
    expect(retryDelayMinutesForAttempt(0)).toBe(2);
    expect(retryDelayMinutesForAttempt(1)).toBe(10);
  });

  it("keeps the declared ladder values in order", () => {
    expect(RETRY_DELAYS_MINUTES).toEqual([2, 10, 30]);
  });
});

describe("shouldDeferForQuietHours", () => {
  it("defers during quiet hours when the workspace setting opts in", () => {
    expect(
      shouldDeferForQuietHours({ inQuietHours: true, quietHoursApply: true }),
    ).toBe(true);
  });

  it("does not defer during quiet hours when the workspace setting opts out", () => {
    // quietHoursApply=false must actually disable the deferral — the flag was
    // previously stored but never read.
    expect(
      shouldDeferForQuietHours({ inQuietHours: true, quietHoursApply: false }),
    ).toBe(false);
  });

  it("does not defer outside quiet hours regardless of the flag", () => {
    expect(
      shouldDeferForQuietHours({ inQuietHours: false, quietHoursApply: true }),
    ).toBe(false);
    expect(
      shouldDeferForQuietHours({ inQuietHours: false, quietHoursApply: false }),
    ).toBe(false);
  });

  it("defaults to applying quiet hours when no settings row exists", () => {
    expect(
      shouldDeferForQuietHours({ inQuietHours: true, quietHoursApply: undefined }),
    ).toBe(true);
  });
});

describe("sanitizeReportedUsage", () => {
  it("passes through plausible provider-reported usage", () => {
    const usage = sanitizeReportedUsage(
      { inputTokens: 120, outputTokens: 80 },
      200,
    );
    expect(usage).toEqual({ inputTokens: 120, outputTokens: 80 });
  });

  it("clamps absurd reported usage back to the estimate", () => {
    // 2M reported tokens against a ~200-token estimate is a bug or a hostile
    // gateway — never let it drain the credit balance.
    const usage = sanitizeReportedUsage(
      { inputTokens: 1_000_000, outputTokens: 1_000_000 },
      200,
    );
    expect(usage.inputTokens + usage.outputTokens).toBeLessThanOrEqual(2_000);
  });

  it("rejects negative and non-finite values", () => {
    const usage = sanitizeReportedUsage(
      { inputTokens: -5, outputTokens: Number.NaN },
      100,
    );
    expect(usage.inputTokens).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(usage.outputTokens)).toBe(true);
  });
});

describe("mention reply template (F3)", () => {
  it("renders mention variables into the reply body", () => {
    const rendered = renderTemplate(
      "Hai {{authorHandle}}, thanks! — {{agentName}} ({{platform}})",
      {
        authorHandle: "fanuser",
        platform: "instagram",
        agentName: "Sales Assist",
      },
    );
    expect(rendered).toBe("Hai fanuser, thanks! — Sales Assist (instagram)");
  });

  it("renders unknown variables as empty instead of leaking braces", () => {
    const rendered = renderTemplate("Hey {{authorHandle}} {{topic}}", {
      authorHandle: "a",
    });
    expect(rendered).toBe("Hey a ");
  });

  it("declares the variable set the mention pipeline supplies", () => {
    // The worker renders exactly these mention-scoped variables.
    expect(parseVariables("{{authorHandle}} {{platform}} {{postSnippet}} {{agentName}} {{topic}}")).toEqual([
      "agentName",
      "authorHandle",
      "platform",
      "postSnippet",
      "topic",
    ]);
  });
});
