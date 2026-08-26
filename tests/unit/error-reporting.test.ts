import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("error reporting", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs locally when SENTRY_DSN is not configured", async () => {
    vi.stubEnv("SENTRY_DSN", "");
    const { reportError } = await import("@/lib/error-reporting");

    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await reportError(new Error("boom"), { scope: "test:no-dsn" });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalled();
  });

  it("sends to Sentry store endpoint when DSN is configured", async () => {
    vi.stubEnv(
      "SENTRY_DSN",
      "https://abc123def@o0.ingest.sentry.io/1234567",
    );
    const { reportError } = await import("@/lib/error-reporting");

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 200 }));

    await reportError(new Error("remote boom"), {
      scope: "test:with-dsn",
      workspaceId: "w1",
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://o0.ingest.sentry.io/api/1234567/store/");
    expect((init.headers as Record<string, string>)["x-sentry-auth"]).toContain(
      "sentry_key=abc123def",
    );
    const body = JSON.parse(init.body as string);
    expect(body.exception.values[0].value).toBe("remote boom");
    expect(body.tags.scope).toBe("test:with-dsn");
    expect(body.extra.workspaceId).toBe("w1");
  });

  it("never throws when the remote ingest fails", async () => {
    vi.stubEnv("SENTRY_DSN", "https://abc123def@o0.ingest.sentry.io/1234567");
    const { reportError } = await import("@/lib/error-reporting");

    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));

    await expect(
      reportError(new Error("original"), { scope: "test:ingest-fail" }),
    ).resolves.toBeUndefined();
    expect(console.warn).toHaveBeenCalled();
  });

  it("skips remote send on unparseable DSN", async () => {
    vi.stubEnv("SENTRY_DSN", "not-a-dsn");
    const { reportError } = await import("@/lib/error-reporting");

    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await reportError(new Error("x"), { scope: "test:bad-dsn" });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalled();
  });

  it("withErrorReporting rethrows after reporting", async () => {
    vi.stubEnv("SENTRY_DSN", "");
    const { withErrorReporting } = await import("@/lib/error-reporting");

    await expect(
      withErrorReporting("test:wrapper", async () => {
        throw new Error("inner failure");
      }),
    ).rejects.toThrow("inner failure");
    expect(console.error).toHaveBeenCalled();
  });

  it("withErrorReporting passes values through on success", async () => {
    vi.stubEnv("SENTRY_DSN", "");
    const { withErrorReporting } = await import("@/lib/error-reporting");

    const result = await withErrorReporting("test:wrapper-ok", async () => 42);
    expect(result).toBe(42);
  });
});
