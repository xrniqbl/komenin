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

describe("mention ingest readiness (F2)", () => {
  const extraKeys = [
    "INSTAGRAM_APP_SECRET",
    "THREADS_APP_SECRET",
    "TIKTOK_CLIENT_SECRET",
    "INSTAGRAM_WEBHOOK_VERIFY_TOKEN",
  ] as const;
  const extraSnapshot: Record<string, string | undefined> = {};

  function saveExtra() {
    for (const key of extraKeys) extraSnapshot[key] = process.env[key];
  }
  function restoreExtra() {
    for (const key of extraKeys) {
      if (extraSnapshot[key] === undefined) delete process.env[key];
      else process.env[key] = extraSnapshot[key];
    }
  }

  saveExtra();
  afterEach(restoreExtra);

  it("warns when no mention ingest path is configured", () => {
    process.env.SIMULATOR_MODE = "false";
    process.env.SOCIAL_PUBLISH_WEBHOOK_URL = "https://bridge.example/hooks/aether";
    process.env.SOCIAL_PUBLISH_WEBHOOK_TOKEN = "super-secret-token-value";
    for (const key of extraKeys) delete process.env[key];
    const result = evaluateLiveReadiness();
    expect(
      result.warnings.some((w) => w.includes("mention ingest path")),
    ).toBe(true);
  });

  it("does not warn about mention ingest when an app secret is set", () => {
    process.env.SIMULATOR_MODE = "false";
    process.env.SOCIAL_PUBLISH_WEBHOOK_URL = "https://bridge.example/hooks/aether";
    process.env.SOCIAL_PUBLISH_WEBHOOK_TOKEN = "super-secret-token-value";
    process.env.INSTAGRAM_APP_SECRET = "ig-app-secret";
    process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN = "verify-me";
    const result = evaluateLiveReadiness();
    expect(
      result.warnings.some((w) => w.includes("mention ingest path")),
    ).toBe(false);
    expect(
      result.warnings.some((w) => w.includes("INSTAGRAM_WEBHOOK_VERIFY_TOKEN")),
    ).toBe(false);
  });

  it("warns about the missing Meta verify token when only the app secret is set", () => {
    process.env.SIMULATOR_MODE = "false";
    process.env.SOCIAL_PUBLISH_WEBHOOK_URL = "https://bridge.example/hooks/aether";
    process.env.SOCIAL_PUBLISH_WEBHOOK_TOKEN = "super-secret-token-value";
    process.env.INSTAGRAM_APP_SECRET = "ig-app-secret";
    delete process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN;
    const result = evaluateLiveReadiness();
    expect(
      result.warnings.some((w) => w.includes("INSTAGRAM_WEBHOOK_VERIFY_TOKEN")),
    ).toBe(true);
  });
});
