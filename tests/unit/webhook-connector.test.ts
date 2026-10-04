import { afterEach, describe, expect, it, vi } from "vitest";
import { safeOutboundFetch } from "@/lib/url-safety";
import { runWebhookConnector } from "@/lib/connectors/webhook";
import type { ConnectorActionInput } from "@/lib/connectors/types";

vi.mock("@/lib/url-safety", async () => {
  const actual = await vi.importActual<typeof import("@/lib/url-safety")>(
    "@/lib/url-safety",
  );
  return {
    ...actual,
    safeOutboundFetch: vi.fn(),
  };
});

const fetchMock = safeOutboundFetch as unknown as ReturnType<typeof vi.fn>;

function baseInput(over: Partial<ConnectorActionInput> = {}): ConnectorActionInput {
  return {
    action: "sendComment",
    runtimeMode: "live",
    policy: "prefer_webhook",
    target: { platform: "instagram", username: "brand", accountId: "acc1" },
    payload: {
      body: "hi",
      targetPostExternalId: "p1",
      targetPostUrl: "https://example.com/p/1",
      authorHandle: "user",
    },
    webhook: {
      url: "https://bridge.example/hooks/komenin",
      token: "super-secret-token",
    },
    official: null,
    ...over,
  };
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("runWebhookConnector", () => {
  afterEach(() => {
    fetchMock.mockReset();
  });

  it("marks sendComment ok on valid 200 JSON", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { ok: true, externalId: "c_1" }));
    const result = await runWebhookConnector(baseInput());
    expect(result.ok).toBe(true);
    expect(result.externalId).toBe("c_1");
    expect(result.connector).toBe("webhook");
    const init = fetchMock.mock.calls[0][1] as { headers: Record<string, string> };
    expect(init.headers["x-komenin-contract"]).toBe("v1");
    expect(init.headers.authorization).toBe("Bearer super-secret-token");
  });

  it("fails on HTTP 200 with ok:false", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, { ok: false, error: "upstream denied" }),
    );
    const result = await runWebhookConnector(baseInput());
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/upstream denied|Invalid bridge/i);
  });

  it("fails on non-JSON 200 body", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response("not-json", { status: 200, headers: { "content-type": "text/plain" } }),
    );
    const result = await runWebhookConnector(baseInput());
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/not JSON/i);
  });

  it("fails on HTTP 500", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(500, { error: "boom" }));
    const result = await runWebhookConnector(baseInput());
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/boom|500/i);
  });

  it("accepts empty discover posts without inventing", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { ok: true, posts: [] }));
    const result = await runWebhookConnector(
      baseInput({
        action: "discoverPosts",
        payload: { query: "x", limit: 3 },
      }),
    );
    expect(result.ok).toBe(true);
    expect(result.posts).toEqual([]);
  });

  it("fails when posts is not an array", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { posts: "nope" }));
    const result = await runWebhookConnector(
      baseInput({
        action: "discoverPosts",
        payload: { query: "x" },
      }),
    );
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/posts must be an array/i);
  });

  it("returns not-configured without calling fetch when webhook url missing", async () => {
    const result = await runWebhookConnector(
      baseInput({ webhook: { url: "", token: "t" } }),
    );
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/not configured/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("wraps UnsafeUrlError as blocked message", async () => {
    const { UnsafeUrlError } = await import("@/lib/url-safety");
    fetchMock.mockRejectedValueOnce(new UnsafeUrlError("localhost blocked"));
    const result = await runWebhookConnector(baseInput());
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/Webhook blocked: localhost blocked/);
  });
});
