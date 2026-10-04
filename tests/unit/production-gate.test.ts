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
  // Vitest leaks the local .env into process.env, so pin these values to keep
  // the gate tests hermetic across machines.
  vi.stubEnv(
    "SOCIAL_CONNECTOR_POLICY",
    overrides.SOCIAL_CONNECTOR_POLICY ?? "prefer_webhook",
  );
  vi.stubEnv(
    "SOCIAL_PUBLISH_WEBHOOK_URL",
    overrides.SOCIAL_PUBLISH_WEBHOOK_URL ?? "https://bridge.example/hooks/komenin",
  );
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
  vi.stubEnv("AUTH_URL", overrides.AUTH_URL ?? overrides.APP_URL ?? "https://app.example.com");
  // DIRECT_DATABASE_URL must be the direct non-pooler endpoint, distinct from
  // the pooled DATABASE_URL (PgBouncer strands the migration advisory lock).
  vi.stubEnv(
    "DIRECT_DATABASE_URL",
    overrides.DIRECT_DATABASE_URL ?? "postgresql://user:pass@direct-db.internal:5432/db",
  );
  // SSO kill-switches must stay off — pin hermetic so leaked host env cannot
  // flip these between machines.
  setEnv("SSO_ENFORCE_LOGIN", "SSO_ENFORCE_LOGIN" in overrides ? overrides.SSO_ENFORCE_LOGIN : undefined);
  setEnv("SAML_ALLOW_UNSIGNED", "SAML_ALLOW_UNSIGNED" in overrides ? overrides.SAML_ALLOW_UNSIGNED : undefined);
  setEnv("ALLOW_SECURITY_STUBS", "ALLOW_SECURITY_STUBS" in overrides ? overrides.ALLOW_SECURITY_STUBS : undefined);
  // New required production secrets (gate errors without them). Pinned here so
  // the hermetic tests reflect a sane production configuration.
  vi.stubEnv("OAUTH_STATE_SECRET", "oauth-state-secret-16xx");
  vi.stubEnv("SSO_TICKET_SECRET", "sso-ticket-secret-16xx");
  vi.stubEnv("API_KEY_PEPPER", "api-key-pepper-16xx");
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://upstash.example/upstash");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "upstash-token");
  // BACKUP_PLAINTEXT_OK is opt-in only — pin it off so tests reflect a
  // genuine omission (warning expected) unless a test enables it.
  setEnv("BACKUP_PLAINTEXT_OK", undefined);
  delete process.env.BACKUP_PLAINTEXT_OK;
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
    vi.stubEnv("SOCIAL_PUBLISH_WEBHOOK_URL", "https://bridge.example/hooks/komenin");
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

  it("fails when AUTH_URL differs from APP_URL", () => {
    setBaseEnv({
      APP_URL: "https://app.example.com",
      AUTH_URL: "https://other.example.com",
    });
    const gate = evaluateProductionGate();
    expect(gate.ok).toBe(false);
    expect(gate.errors.some((e) => e.includes("AUTH_URL and APP_URL differ"))).toBe(true);
  });

  it("refuses SSO kill-switches in production", () => {
    for (const flag of ["SSO_ENFORCE_LOGIN", "SAML_ALLOW_UNSIGNED", "ALLOW_SECURITY_STUBS"] as const) {
      setBaseEnv({ [flag]: "true" } as Record<string, string>);
      const gate = evaluateProductionGate();
      expect(gate.ok).toBe(false);
      expect(gate.errors.some((e) => e.includes(flag))).toBe(true);
      vi.unstubAllEnvs();
    }
  });

  it("requires a direct non-pooler DIRECT_DATABASE_URL", () => {
    setBaseEnv({ DIRECT_DATABASE_URL: "" });
    vi.stubEnv("DIRECT_DATABASE_URL", undefined as unknown as string);
    delete process.env.DIRECT_DATABASE_URL;
    expect(evaluateProductionGate().ok).toBe(false);

    setBaseEnv({
      DIRECT_DATABASE_URL: "postgresql://user:pass@ep-xyz-pooler.aws.neon.tech:5432/db",
    });
    const gate = evaluateProductionGate();
    expect(gate.ok).toBe(false);
    expect(gate.errors.some((e) => e.includes("DIRECT_DATABASE_URL"))).toBe(true);
  });

  it("accepts identical non-pooler URLs (self-hosted Docker, no PgBouncer)", () => {
    setBaseEnv({
      DATABASE_URL: "postgresql://komenin:pw@db:5432/komenin?schema=public",
      DIRECT_DATABASE_URL: "postgresql://komenin:pw@db:5432/komenin?schema=public",
    });
    const gate = evaluateProductionGate();
    expect(gate.errors.some((e) => e.includes("DIRECT_DATABASE_URL"))).toBe(false);
  });

  it("rejects identical pooler URLs (Neon/Vercel PgBouncer lock risk)", () => {
    setBaseEnv({
      DATABASE_URL: "postgresql://u:p@ep-xyz-pooler.aws.neon.tech:5432/db?connection_limit=5",
      DIRECT_DATABASE_URL: "postgresql://u:p@ep-xyz-pooler.aws.neon.tech:5432/db?connection_limit=5",
    });
    const gate = evaluateProductionGate();
    expect(gate.ok).toBe(false);
    expect(gate.errors.some((e) => e.includes("DIRECT_DATABASE_URL"))).toBe(true);
  });

  it("warns on missing BACKUP_ENCRYPTION_KEY unless plaintext is acknowledged", () => {
    setBaseEnv();
    delete process.env.BACKUP_ENCRYPTION_KEY;
    setEnv("BACKUP_PLAINTEXT_OK", undefined);
    delete process.env.BACKUP_PLAINTEXT_OK;
    expect(
      evaluateProductionGate().warnings.some((w) => w.includes("BACKUP_ENCRYPTION_KEY")),
    ).toBe(true);

    setBaseEnv();
    delete process.env.BACKUP_ENCRYPTION_KEY;
    vi.stubEnv("BACKUP_PLAINTEXT_OK", "true");
    expect(
      evaluateProductionGate().warnings.some((w) => w.includes("BACKUP_ENCRYPTION_KEY")),
    ).toBe(false);
  });
});
