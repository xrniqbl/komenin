import { afterEach, describe, expect, it } from "vitest";
import { evaluateLiveReadiness } from "@/lib/runtime-mode";

const KEYS = [
  "SIMULATOR_MODE",
  "SOCIAL_PUBLISH_WEBHOOK_URL",
  "SOCIAL_PUBLISH_WEBHOOK_TOKEN",
  "SOCIAL_CONNECTOR_POLICY",
  "SOCIAL_OFFICIAL_API_BASE_URL",
  "WORKER_SECRET",
  "APP_URL",
  "CRON_SECRET",
  "INSTAGRAM_ACCESS_TOKEN",
  "THREADS_ACCESS_TOKEN",
  "TIKTOK_ACCESS_TOKEN",
  "SOCIAL_OFFICIAL_API_TOKEN",
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

  it("blocks self-hosted /api/publish/webhook as a live bridge", () => {
    process.env.SIMULATOR_MODE = "false";
    process.env.APP_URL = "https://app.example.com";
    process.env.SOCIAL_PUBLISH_WEBHOOK_URL =
      "https://app.example.com/api/publish/webhook";
    process.env.SOCIAL_PUBLISH_WEBHOOK_TOKEN = "super-secret-token-value";
    const result = evaluateLiveReadiness();
    expect(result.ready).toBe(false);
    expect(result.blockers.some((b) => /own \/api\/publish\/webhook/i.test(b))).toBe(
      true,
    );
  });
});
