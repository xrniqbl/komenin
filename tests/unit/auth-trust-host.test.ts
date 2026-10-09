import { afterEach, describe, expect, it, vi } from "vitest";

function loadConfig() {
  const path = "@/lib/auth.config";
  vi.resetModules();
  return import(path) as Promise<{ authConfig: { trustHost: boolean } }>;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("auth trustHost", () => {
  it("trusts the host when AUTH_URL is set (production behind nginx)", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_URL", "https://komenin.id");
    const { authConfig } = await loadConfig();
    // Without this, every session/signin/signout call fails with
    // UntrustedHost and users land on the "server configuration" error page.
    expect(authConfig.trustHost).toBe(true);
  });

  it("trusts the host in local dev without AUTH_URL", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("AUTH_URL", "");
    const { authConfig } = await loadConfig();
    expect(authConfig.trustHost).toBe(true);
  });
});
