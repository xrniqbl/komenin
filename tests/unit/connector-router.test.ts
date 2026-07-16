import { describe, expect, it, vi, afterEach } from "vitest";
import {
  resolveConnectorKind,
  runConnectorAction,
  type ConnectorActionInput,
} from "@/lib/connectors";

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
});
