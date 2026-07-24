import { afterEach, describe, expect, it } from "vitest";
import { evaluateLiveReadiness } from "@/lib/runtime-mode";

const KEYS = [
  "SIMULATOR_MODE",
  "SOCIAL_PUBLISH_WEBHOOK_URL",
  "SOCIAL_PUBLISH_WEBHOOK_TOKEN",
  "SOCIAL_CONNECTOR_POLICY",
  "SOCIAL_OFFICIAL_API_BASE_URL",
  "WORKER_SECRET",
] as const;

const snapshot: Record<string, string | undefined> = {};

function saveEnv() {
  for (const key of KEYS) snapshot[key] = process.env[key];
}

function restoreEnv() {
  for (const key of KEYS) {
    if (snapshot[key] === undefined) delete process.env[key];
    else process.env[key] = snapshot[key];
  }
}

describe("evaluateLiveReadiness", () => {
  saveEnv();
  afterEach(() => restoreEnv());

  it("reports simulator as not ready with advisory warning", () => {
    process.env.SIMULATOR_MODE = "true";
    const result = evaluateLiveReadiness();
    expect(result.mode).toBe("simulator");
    expect(result.ready).toBe(false);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("blocks live mode without webhook or official connector", () => {
    process.env.SIMULATOR_MODE = "false";
    delete process.env.SOCIAL_PUBLISH_WEBHOOK_URL;
    delete process.env.SOCIAL_OFFICIAL_API_BASE_URL;
    delete process.env.SOCIAL_PUBLISH_WEBHOOK_TOKEN;
    const result = evaluateLiveReadiness();
    expect(result.mode).toBe("live");
    expect(result.ready).toBe(false);
    expect(result.blockers.length).toBeGreaterThan(0);
  });

  it("is ready when live webhook url + token are set", () => {
    process.env.SIMULATOR_MODE = "false";
    process.env.SOCIAL_PUBLISH_WEBHOOK_URL = "https://bridge.example/hooks/aether";
    process.env.SOCIAL_PUBLISH_WEBHOOK_TOKEN = "super-secret-token-value";
    process.env.SOCIAL_CONNECTOR_POLICY = "prefer_webhook";
    process.env.WORKER_SECRET = "worker-secret-at-least-16";
    const result = evaluateLiveReadiness();
    expect(result.ready).toBe(true);
    expect(result.blockers).toEqual([]);
  });
});
