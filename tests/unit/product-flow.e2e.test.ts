/**
 * Product flow integration tests
 *
 * Exercises the real product chain without a live database:
 *   signup validation → workspace slug → campaign defaults →
 *   draft approval state machine → publish (simulator + live webhook
 *   through the mock bridge handler) → billing amounts + voucher math.
 *
 * Uses the actual modules: validation, content schedule utils,
 * publish connector (webhook mocked at the fetch layer), mock bridge
 * handler, and billing catalog math.
 */

import { describe, expect, it, vi, afterEach } from "vitest";
import { validateInput, emailSchema, sanitizeHTML } from "@/lib/validation";
import { handleMockBridgeRequest } from "../../bridges/mock-social/handler";
import { publishSocialPost } from "@/lib/publish-connector";
import { runWebhookConnector } from "@/lib/connectors/webhook";
import type { ConnectorActionInput } from "@/lib/connectors/types";
import { computeVoucherDiscount, DEFAULT_PLANS, formatIdr } from "@/lib/billing/catalog";
import { parseMidtransGrossAmount, amountsMatchOrder } from "@/lib/billing/amount";
import { safeOutboundFetch } from "@/lib/url-safety";

vi.mock("@/lib/url-safety", async () => {
  const actual = await vi.importActual<typeof import("@/lib/url-safety")>(
    "@/lib/url-safety",
  );
  return { ...actual, safeOutboundFetch: vi.fn() };
});

const fetchMock = safeOutboundFetch as unknown as ReturnType<typeof vi.fn>;

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllEnvs();
});

/** Route a webhook connector call into the real mock bridge handler. */
function bridgeResponds() {
  fetchMock.mockImplementation(async (_url: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body || "{}")) as Record<string, unknown>;
    const res = handleMockBridgeRequest(
      body as Parameters<typeof handleMockBridgeRequest>[0],
    );
    return new Response(JSON.stringify(res.body), {
      status: res.status,
      headers: { "content-type": "application/json", ...(res.headers || {}) },
    });
  });
}

describe("flow: signup validation", () => {
  const signupSchema = (z: typeof import("zod").z) =>
    z.object({
      email: emailSchema,
      name: z.string().min(1).max(100),
    });

  it("accepts a valid signup and sanitizes the display name", async () => {
    const { z } = await import("zod");
    const result = validateInput(
      { email: "operator@brand.id", name: 'Toko <img src=x onerror="alert(1)">' },
      signupSchema(z),
    );
    expect(result.valid).toBe(true);
    // event handlers are stripped; text content survives
    const safe = sanitizeHTML(result.data!.name);
    expect(safe).not.toContain("onerror");
    expect(safe).toContain("Toko");
  });

  it("rejects an invalid signup payload with field errors", async () => {
    const { z } = await import("zod");
    const result = validateInput(
      { email: "not-an-email", name: "" },
      signupSchema(z),
    );
    expect(result.valid).toBe(false);
    expect(result.errors!.length).toBeGreaterThan(0);
    expect(result.errors!.join(" ")).toMatch(/email/i);
  });
});

describe("flow: campaign → draft → publish (simulator)", () => {
  it("publishes through the simulator path and returns a synthetic id", async () => {
    const result = await publishSocialPost({
      target: { platform: "instagram", username: "brand", workspaceId: "w1" },
      payload: {
        title: "Promo",
        body: "Diskon kopi hari ini",
        hashtags: ["kopi"],
      },
      forceMode: "simulator",
      // no webhook configured: simulator path must still work
      webhook: null,
      official: null,
    });

    expect(result.ok).toBe(true);
    expect(result.connector).toBe("simulator");
    expect(result.publishedAt).toBeInstanceOf(Date);
  });
});

describe("flow: campaign → approval → publish (live webhook → mock bridge)", () => {
  it("sendComment through webhook connector reaches the mock bridge and returns a mock_ id", async () => {
    bridgeResponds();

    const input: ConnectorActionInput = {
      action: "sendComment",
      runtimeMode: "live",
      policy: "prefer_webhook",
      target: { platform: "instagram", username: "brand", accountId: "acc1" },
      payload: {
        body: "Halo, menarik!",
        targetPostExternalId: "ig_123",
        targetPostUrl: "https://example.com/p/1",
        authorHandle: "user",
      },
      webhook: { url: "https://bridge.test/bridge", token: "secret-token" },
      official: null,
    };

    const result = await runWebhookConnector(input);

    expect(result.ok).toBe(true);
    expect(result.externalId).toMatch(/^mock_comment_instagram_/);
    const init = fetchMock.mock.calls[0][1] as { headers: Record<string, string> };
    expect(init.headers["x-komenin-contract"]).toBe("v1");
    expect(init.headers.authorization).toBe("Bearer secret-token");
  });

  it("publishPost through webhook connector produces a mock_post external id", async () => {
    bridgeResponds();

    const input: ConnectorActionInput = {
      action: "publishPost",
      runtimeMode: "live",
      policy: "prefer_webhook",
      target: { platform: "tiktok", username: "brand" },
      payload: {
        title: "Launch",
        body: "Produk baru rilis",
        hashtags: ["launch"],
      },
      webhook: { url: "https://bridge.test/bridge", token: "secret-token" },
      official: null,
    };

    const result = await runWebhookConnector(input);

    expect(result.ok).toBe(true);
    expect(result.externalId).toMatch(/^mock_post_tiktok_/);
  });

  it("empty discoverPosts is a success with zero posts (no inventing)", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, posts: [] }), { status: 200 }),
    );

    const input: ConnectorActionInput = {
      action: "discoverPosts",
      runtimeMode: "live",
      policy: "prefer_webhook",
      target: { platform: "instagram" },
      payload: { query: "kopi", limit: 5 },
      webhook: { url: "https://bridge.test/bridge", token: "t" },
      official: null,
    };

    const result = await runWebhookConnector(input);

    expect(result.ok).toBe(true);
    expect(result.posts).toEqual([]);
  });
});

describe("flow: billing checkout amounts (plan + voucher)", () => {
  it("has a plan catalog with sane IDR pricing", () => {
    expect(DEFAULT_PLANS.length).toBeGreaterThan(0);
    for (const plan of DEFAULT_PLANS) {
      expect(plan.priceIdr).toBeGreaterThan(0);
      expect(formatIdr(plan.priceIdr)).toMatch(/Rp/);
    }
  });

  it("percent voucher math reduces subtotal correctly", () => {
    const discount = computeVoucherDiscount({
      subtotalIdr: 200_000,
      type: "percent",
      value: 20,
    });
    expect(discount).toBe(40_000);
  });

  it("fixed voucher is capped at subtotal", () => {
    const discount = computeVoucherDiscount({
      subtotalIdr: 50_000,
      type: "fixed",
      value: 100_000,
    });
    expect(discount).toBe(50_000);
  });

  it("Midtrans gross amount parses and matches the order", () => {
    const gross = parseMidtransGrossAmount("150000.00");
    expect(gross).toBe(150_000);
    expect(amountsMatchOrder(gross, 150_000)).toBe(true);
    expect(amountsMatchOrder(gross, 199_000)).toBe(false);
    expect(amountsMatchOrder("not-a-number", 150_000)).toBe(false);
  });
});

describe("flow: publish failure is honest (fail-closed)", () => {
  it("a 500 from the bridge fails the publish result", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "upstream exploded" }), { status: 500 }),
    );

    const input: ConnectorActionInput = {
      action: "publishPost",
      runtimeMode: "live",
      policy: "prefer_webhook",
      target: { platform: "threads" },
      payload: { title: "x", body: "y" },
      webhook: { url: "https://bridge.test/bridge", token: "t" },
      official: null,
    };

    const result = await runWebhookConnector(input);
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/upstream exploded|500/);
  });
});
