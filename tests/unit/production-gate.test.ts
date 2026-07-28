import { afterEach, describe, expect, it, vi } from "vitest";
import { evaluateProductionGate } from "@/lib/production-gate";

function setEnv(key: string, value: string | undefined) {
  if (value === undefined) vi.stubEnv(key, undefined as unknown as string);
  else vi.stubEnv(key, value);
}

function setBaseEnv(overrides: Record<string, string | undefined> = {}) {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv(
    "DATABASE_URL",
    overrides.DATABASE_URL ?? "postgresql://user:pass@localhost:5432/db",
  );
  vi.stubEnv("AUTH_SECRET", overrides.AUTH_SECRET ?? "auth-secret-at-least-16");
  vi.stubEnv("AUTH_GOOGLE_ID", overrides.AUTH_GOOGLE_ID ?? "google-id");
  vi.stubEnv("AUTH_GOOGLE_SECRET", overrides.AUTH_GOOGLE_SECRET ?? "google-secret");
  vi.stubEnv(
    "ENCRYPTION_KEY",
    overrides.ENCRYPTION_KEY ??
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  );
  vi.stubEnv("WORKER_SECRET", overrides.WORKER_SECRET ?? "worker-secret-16xx");
  vi.stubEnv("SIMULATOR_MODE", overrides.SIMULATOR_MODE ?? "false");
  setEnv(
    "SOCIAL_PUBLISH_WEBHOOK_TOKEN",
    "SOCIAL_PUBLISH_WEBHOOK_TOKEN" in overrides
      ? overrides.SOCIAL_PUBLISH_WEBHOOK_TOKEN
      : "publish-token",
  );
  setEnv("MIDTRANS_IS_PRODUCTION", overrides.MIDTRANS_IS_PRODUCTION);
  setEnv("MIDTRANS_SERVER_KEY", overrides.MIDTRANS_SERVER_KEY);
  setEnv("MIDTRANS_CLIENT_KEY", overrides.MIDTRANS_CLIENT_KEY);
  vi.stubEnv("APP_URL", overrides.APP_URL ?? "https://app.example.com");
  vi.stubEnv("AUTH_URL", overrides.AUTH_URL ?? "https://app.example.com");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("production gate", () => {
  it("fails closed when SIMULATOR_MODE=true in production", () => {
    setBaseEnv({ SIMULATOR_MODE: "true" });
    const gate = evaluateProductionGate();
    expect(gate.ok).toBe(false);
    expect(gate.errors.some((e) => e.includes("SIMULATOR_MODE"))).toBe(true);
  });

  it("fails when live mode lacks publish webhook token", () => {
    setBaseEnv({
      SIMULATOR_MODE: "false",
      SOCIAL_PUBLISH_WEBHOOK_TOKEN: "",
    });
    vi.stubEnv("SOCIAL_PUBLISH_WEBHOOK_TOKEN", undefined as unknown as string);
    delete process.env.SOCIAL_PUBLISH_WEBHOOK_TOKEN;
    const gate = evaluateProductionGate();
    expect(gate.ok).toBe(false);
    expect(gate.errors.some((e) => e.includes("SOCIAL_PUBLISH_WEBHOOK_TOKEN"))).toBe(true);
  });

  it("passes a sane production configuration", () => {
    setBaseEnv({
      SIMULATOR_MODE: "false",
      SOCIAL_PUBLISH_WEBHOOK_TOKEN: "token",
      MIDTRANS_IS_PRODUCTION: "true",
      MIDTRANS_SERVER_KEY: "SB-server",
      MIDTRANS_CLIENT_KEY: "SB-client",
    });
    vi.stubEnv("SOCIAL_PUBLISH_WEBHOOK_URL", "https://bridge.example/hooks/aether");
    vi.stubEnv("SOCIAL_CONNECTOR_POLICY", "prefer_webhook");
    const gate = evaluateProductionGate();
    expect(gate.ok).toBe(true);
    expect(gate.errors).toEqual([]);
  });

  it("allows official_only live without webhook token", () => {
    setBaseEnv({
      SIMULATOR_MODE: "false",
      SOCIAL_PUBLISH_WEBHOOK_TOKEN: "",
    });
    vi.stubEnv("SOCIAL_PUBLISH_WEBHOOK_TOKEN", undefined as unknown as string);
    delete process.env.SOCIAL_PUBLISH_WEBHOOK_TOKEN;
    delete process.env.SOCIAL_PUBLISH_WEBHOOK_URL;
    vi.stubEnv("SOCIAL_CONNECTOR_POLICY", "official_only");
    vi.stubEnv("INSTAGRAM_ACCESS_TOKEN", "ig-token");
    const gate = evaluateProductionGate();
    expect(gate.ok).toBe(true);
  });

  it("fails when live webhook points at this app's own publish endpoint", () => {
    setBaseEnv({
      SIMULATOR_MODE: "false",
      SOCIAL_PUBLISH_WEBHOOK_TOKEN: "token",
      APP_URL: "https://app.example.com",
    });
    vi.stubEnv(
      "SOCIAL_PUBLISH_WEBHOOK_URL",
      "https://app.example.com/api/publish/webhook",
    );
    const gate = evaluateProductionGate();
    expect(gate.ok).toBe(false);
    expect(gate.errors.some((e) => e.includes("external bridge"))).toBe(true);
  });
});
