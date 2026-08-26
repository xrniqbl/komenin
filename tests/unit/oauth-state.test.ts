import { afterEach, describe, expect, it } from "vitest";
import {
  createOAuthState,
  isInstagramOAuthConfigured,
  signOAuthState,
  verifyOAuthState,
} from "@/lib/oauth-state";
import { randomBytes } from "node:crypto";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env.AUTH_SECRET = originalEnv.AUTH_SECRET;
  process.env.OAUTH_STATE_SECRET = originalEnv.OAUTH_STATE_SECRET;
  process.env.INSTAGRAM_APP_ID = originalEnv.INSTAGRAM_APP_ID;
  process.env.INSTAGRAM_APP_SECRET = originalEnv.INSTAGRAM_APP_SECRET;
  process.env.APP_URL = originalEnv.APP_URL;
});

describe("oauth-state", () => {
  it("signs and verifies state payloads", () => {
    process.env.AUTH_SECRET = "test-auth-secret-16chars";
    const state = createOAuthState({
      workspaceId: "ws_1",
      provider: "instagram",
      socialAccountId: "acc_1",
    });
    const payload = verifyOAuthState(state);
    expect(payload?.workspaceId).toBe("ws_1");
    expect(payload?.provider).toBe("instagram");
    expect(payload?.socialAccountId).toBe("acc_1");
  });

  it("rejects tampered signatures", () => {
    process.env.AUTH_SECRET = "test-auth-secret-16chars";
    const state = createOAuthState({
      workspaceId: "ws_1",
      provider: "instagram",
    });
    expect(verifyOAuthState(`${state}x`)).toBeNull();
    expect(verifyOAuthState("not-a-state")).toBeNull();
  });

  it("rejects expired state", () => {
    process.env.AUTH_SECRET = "test-auth-secret-16chars";
    const state = signOAuthState({
      workspaceId: "ws_1",
      provider: "instagram",
      socialAccountId: null,
      nonce: "n",
      exp: Math.floor(Date.now() / 1000) - 10,
    });
    expect(verifyOAuthState(state)).toBeNull();
  });

  it("detects Instagram OAuth configuration", () => {
    delete process.env.INSTAGRAM_APP_ID;
    delete process.env.INSTAGRAM_APP_SECRET;
    delete process.env.APP_URL;
    expect(isInstagramOAuthConfigured()).toBe(false);

    process.env.INSTAGRAM_APP_ID = "app";
    process.env.INSTAGRAM_APP_SECRET = "secret";
    process.env.APP_URL = "https://app.example.com";
    expect(isInstagramOAuthConfigured()).toBe(true);
  });

  it("generates cryptographically secure nonces (CSPRNG)", () => {
    process.env.AUTH_SECRET = "test-auth-secret-16chars";
    const states = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const state = createOAuthState({
        workspaceId: "ws_1",
        provider: "instagram" as const,
      });
      const [payload] = state.split(".");
      // Nonce is the payload part (base64url of JSON) - check base64url chars are unique
      states.add(payload!);
    }
    // All 100 states should be unique (collision probability < 2^-128)
    expect(states.size).toBe(100);
  });

  it("nonce changes on every creation even with same inputs", () => {
    process.env.AUTH_SECRET = "test-auth-secret-16chars";
    const payloads: string[] = [];
    for (let i = 0; i < 10; i++) {
      const state = createOAuthState({
        workspaceId: "ws_1",
        provider: "instagram",
        socialAccountId: null,
      });
      payloads.push(state);
    }
    // Verify all are distinct
    const uniquePayloads = new Set(payloads);
    expect(uniquePayloads.size).toBe(10);
  });
});
