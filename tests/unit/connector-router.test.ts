import { describe, expect, it, vi, afterEach } from "vitest";
import {
  resolveConnectorKind,
  runConnectorAction,
  type ConnectorActionInput,
} from "@/lib/connectors";
import { runThreadsNative } from "@/lib/connectors/official/native";

describe("connector router", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("selects simulator when runtime mode is simulator", () => {
    expect(
      resolveConnectorKind({
        runtimeMode: "simulator",
        policy: "prefer_webhook",
        hasWebhook: true,
        hasOfficial: true,
        action: "publishPost",
      }),
    ).toBe("simulator");
  });

  it("prefers official when policy prefers official and capability exists", () => {
    expect(
      resolveConnectorKind({
        runtimeMode: "live",
        policy: "prefer_official",
        hasWebhook: true,
        hasOfficial: true,
        action: "publishPost",
      }),
    ).toBe("official");
  });

  it("falls back to webhook when official unsupported", () => {
    expect(
      resolveConnectorKind({
        runtimeMode: "live",
        policy: "prefer_official",
        hasWebhook: true,
        hasOfficial: false,
        action: "sendComment",
      }),
    ).toBe("webhook");
  });

  it("fails closed in live mode without webhook or official", async () => {
    const input: ConnectorActionInput = {
      action: "publishPost",
      runtimeMode: "live",
      policy: "prefer_webhook",
      target: { platform: "instagram", username: "brand" },
      payload: { body: "hello world" },
      webhook: null,
      official: null,
    };

    const result = await runConnectorAction(input);
    expect(result.ok).toBe(false);
    expect(result.connector).toBe("none");
    expect(result.message).toMatch(/not configured|fail closed|credentials/i);
  });

  it("uses simulator successfully for discoverPosts", async () => {
    const result = await runConnectorAction({
      action: "discoverPosts",
      runtimeMode: "simulator",
      policy: "prefer_webhook",
      target: { platform: "threads", username: "listener" },
      payload: { query: "crm tools", limit: 2 },
      webhook: null,
      official: null,
    });

    expect(result.ok).toBe(true);
    expect(result.connector).toBe("simulator");
    expect(result.posts?.length).toBeGreaterThan(0);
  });

  it("publishes a Threads native reply via create -> publish with reply_to_id", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "creation_1" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "reply_99" }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const result = await runThreadsNative({
      action: "sendComment",
      runtimeMode: "live",
      policy: "prefer_official",
      target: { platform: "threads", username: "brand" },
      payload: { body: "great post!", targetPostExternalId: "post_42" },
      webhook: null,
      official: { provider: "threads", accessToken: "tok_123" },
    });

    expect(result.ok).toBe(true);
    expect(result.externalId).toBe("reply_99");

    const createBody = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(createBody.reply_to_id).toBe("post_42");
    expect(createBody.media_type).toBe("TEXT");

    const publishBody = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    expect(publishBody.creation_id).toBe("creation_1");
  });

  it("requires targetPostExternalId for a Threads native reply", async () => {
    const result = await runThreadsNative({
      action: "sendComment",
      runtimeMode: "live",
      policy: "prefer_official",
      target: { platform: "threads", username: "brand" },
      payload: { body: "hi" },
      webhook: null,
      official: { provider: "threads", accessToken: "tok_123" },
    });

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/targetPostExternalId/i);
  });
});
