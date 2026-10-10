import { describe, expect, it, beforeAll, afterEach, vi } from "vitest";
import { resolveConnectorKind, runConnectorAction } from "@/lib/connectors";
import type { ConnectorActionInput } from "@/lib/connectors/types";
import { encryptSecret } from "@/lib/encryption";
import { safeOutboundFetch } from "@/lib/url-safety";

/**
 * Routing rules for the unofficial session path.
 *
 * The whole point of the ordering: simulator and *_only policies are explicit
 * operator intent and must never be silently upgraded, while `session` sits
 * behind webhook/official by default because hitting Instagram's private API
 * with a real cookie is the most ban-prone option we have.
 */

// The router calls runSessionConnector without an injected fetch, so the
// outbound layer must be mocked — no test may open a real connection.
vi.mock("@/lib/url-safety", async () => {
  const actual = await vi.importActual<typeof import("@/lib/url-safety")>(
    "@/lib/url-safety",
  );
  return { ...actual, safeOutboundFetch: vi.fn() };
});

const outboundMock = safeOutboundFetch as unknown as ReturnType<typeof vi.fn>;

const ENCRYPTION_KEY = "b".repeat(64);

beforeAll(() => {
  process.env.ENCRYPTION_KEY = ENCRYPTION_KEY;
});

afterEach(() => {
  outboundMock.mockReset();
});

const base = {
  runtimeMode: "live" as const,
  hasWebhook: false,
  hasOfficial: false,
  hasSession: true,
  action: "publishPost" as const,
};

describe("resolveConnectorKind — session precedence", () => {
  it("uses session as the last fallback under the default policy", () => {
    expect(resolveConnectorKind({ ...base, policy: "prefer_webhook" })).toBe("session");
  });

  it("prefers webhook over session under the default policy", () => {
    expect(
      resolveConnectorKind({ ...base, policy: "prefer_webhook", hasWebhook: true }),
    ).toBe("webhook");
  });

  it("prefers official over session under prefer_official", () => {
    expect(resolveConnectorKind({ ...base, policy: "prefer_official", hasOfficial: true })).toBe(
      "official",
    );
    expect(resolveConnectorKind({ ...base, policy: "prefer_official" })).toBe("session");
  });

  it("puts session first under prefer_session", () => {
    expect(
      resolveConnectorKind({
        ...base,
        policy: "prefer_session",
        hasWebhook: true,
        hasOfficial: true,
      }),
    ).toBe("session");
  });

  it("falls back to webhook then official when prefer_session has no cookie", () => {
    expect(
      resolveConnectorKind({
        ...base,
        policy: "prefer_session",
        hasSession: false,
        hasWebhook: true,
      }),
    ).toBe("webhook");
    expect(
      resolveConnectorKind({
        ...base,
        policy: "prefer_session",
        hasSession: false,
        hasOfficial: true,
      }),
    ).toBe("official");
    expect(
      resolveConnectorKind({ ...base, policy: "prefer_session", hasSession: false }),
    ).toBe("none");
  });

  it("honours session_only and fails closed without a cookie", () => {
    expect(resolveConnectorKind({ ...base, policy: "session_only" })).toBe("session");
    expect(
      resolveConnectorKind({ ...base, policy: "session_only", hasSession: false, hasWebhook: true }),
    ).toBe("none");
  });

  it("never upgrades an *_only policy when a session exists", () => {
    expect(resolveConnectorKind({ ...base, policy: "official_only" })).toBe("none");
    expect(resolveConnectorKind({ ...base, policy: "webhook_only" })).toBe("none");
    expect(resolveConnectorKind({ ...base, policy: "simulator_only" })).toBe("simulator");
  });

  it("keeps simulator above everything", () => {
    expect(
      resolveConnectorKind({
        ...base,
        policy: "session_only",
        runtimeMode: "simulator",
        hasWebhook: true,
        hasOfficial: true,
      }),
    ).toBe("simulator");
  });

  it("treats a missing hasSession flag as false (backward compatible)", () => {
    const { hasSession: _omitted, ...withoutSession } = base;
    expect(resolveConnectorKind({ ...withoutSession, policy: "prefer_webhook" })).toBe("none");
  });
});

describe("runConnectorAction — session dispatch", () => {
  function sessionInput(overrides: Partial<ConnectorActionInput>): ConnectorActionInput {
    return {
      action: "publishPost",
      runtimeMode: "live",
      policy: "session_only",
      target: { platform: "instagram", username: "brand" },
      payload: { body: "halo" },
      webhook: null,
      official: null,
      session: null,
      ...overrides,
    } as ConnectorActionInput;
  }

  it("routes to the session connector when a blob is present", async () => {
    // Deliberately un-decryptable: the dispatcher must reach the session
    // connector (connector === "session") and fail there, not bail earlier.
    const result = await runConnectorAction(
      sessionInput({
        session: { platform: "instagram", encryptedBlob: "v1:00:00:00" },
      }),
    );
    expect(result.connector).toBe("session");
    expect(result.ok).toBe(false);
    expect(result.details?.signal).toBe("decrypt_failed");
  });

  it("does not route to session under the default policy when a webhook exists", async () => {
    outboundMock.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const result = await runConnectorAction(
      sessionInput({
        policy: "prefer_webhook",
        webhook: { url: "https://bridge.example/hook", token: "t" },
        session: { platform: "instagram", encryptedBlob: "v1:00:00:00" },
      }),
    );
    expect(result.connector).toBe("webhook");
    expect(outboundMock).toHaveBeenCalled();
  });

  it("skips session when the blob is empty even under session_only", async () => {
    const result = await runConnectorAction(
      sessionInput({ session: { platform: "instagram", encryptedBlob: "" } }),
    );
    expect(result.connector).toBe("none");
    expect(result.ok).toBe(false);
    expect(result.details?.hasSession).toBe(false);
  });

  it("reports all three capabilities in the fail-closed details", async () => {
    const result = await runConnectorAction(sessionInput({}));
    expect(result.connector).toBe("none");
    expect(result.details).toMatchObject({
      hasWebhook: false,
      hasOfficial: false,
      hasSession: false,
    });
    expect(result.message).toMatch(/session/i);
  });

  it("keeps simulator ahead of the session credential", async () => {
    const result = await runConnectorAction(
      sessionInput({
        runtimeMode: "simulator",
        session: { platform: "instagram", encryptedBlob: "v1:00:00:00" },
      }),
    );
    expect(result.connector).toBe("simulator");
    expect(result.ok).toBe(true);
  });

  it("passes a decryptable blob through to a real session publish", async () => {
    const payload = {
      platform: "instagram",
      username: "brand",
      capturedAt: new Date().toISOString(),
      ua: "Instagram 155 Android",
      cookies: [
        { name: "sessionid", value: "s-1", domain: ".instagram.com", path: "/", secure: true },
        { name: "ds_user_id", value: "424242", domain: ".instagram.com", path: "/", secure: true },
        { name: "csrftoken", value: "csrf-token-1", domain: ".instagram.com", path: "/", secure: true },
      ],
      meta: { source: "test", cookieCount: 3, requiredCookies: [], notes: "" },
    };

    outboundMock.mockResolvedValue(
      new Response(JSON.stringify({ status: "ok", pk: "7_8" }), { status: 200 }),
    );

    const result = await runConnectorAction(
      sessionInput({
        session: {
          platform: "instagram",
          encryptedBlob: encryptSecret(JSON.stringify(payload)),
          username: "brand",
        },
      }),
    );

    expect(result.connector).toBe("session");
    expect(result.ok).toBe(true);
    expect(result.externalId).toBe("7");

    // The private API endpoint must have been called with the cookie attached.
    const [calledUrl, init] = outboundMock.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toContain("i.instagram.com/api/v1/media/configure_text_post_app_feed/");
    expect((init.headers as Record<string, string>).cookie).toContain("sessionid=s-1");

    // Cookie values must never surface in the result itself.
    expect(JSON.stringify(result)).not.toContain("s-1");
  });
});
