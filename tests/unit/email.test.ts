import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("email module", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("isEmailConfigured reflects RESEND_API_KEY", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    const { isEmailConfigured } = await import("@/lib/email");
    expect(isEmailConfigured()).toBe(false);

    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    const fresh = await import("@/lib/email");
    expect(fresh.isEmailConfigured()).toBe(true);
  });

  it("sendEmail no-ops (delivered:false) when not configured", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    const { sendEmail } = await import("@/lib/email");

    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const result = await sendEmail({
      to: "member@example.com",
      subject: "Hello",
      html: "<p>Hi</p>",
    });

    expect(result.delivered).toBe(false);
    expect(result.provider).toBe("none");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("sendEmail posts to Resend with bearer auth and from address", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    vi.stubEnv("EMAIL_FROM", "Aether <noreply@brand.id>");
    const { sendEmail } = await import("@/lib/email");

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}", { status: 200 }));

    const result = await sendEmail({
      to: "member@example.com",
      subject: "You're invited",
      html: "<p>Join us</p>",
      text: "Join us",
    });

    expect(result.delivered).toBe(true);
    expect(result.provider).toBe("resend");

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer re_test_key");
    const body = JSON.parse(init.body as string);
    expect(body.from).toBe("Aether <noreply@brand.id>");
    expect(body.to).toEqual(["member@example.com"]);
    expect(body.subject).toBe("You're invited");
    expect(body.html).toContain("Join us");
  });

  it("sendEmail never throws on provider rejection", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    const { sendEmail } = await import("@/lib/email");

    vi.spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("invalid from", { status: 422 }));

    const result = await sendEmail({
      to: "x@example.com",
      subject: "s",
      html: "b",
    });

    expect(result.delivered).toBe(false);
    expect(result.error).toBe("resend_422");
    expect(console.warn).toHaveBeenCalled();
  });

  it("sendEmail never throws on network failure", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    const { sendEmail } = await import("@/lib/email");

    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("dns fail"));

    const result = await sendEmail({
      to: "x@example.com",
      subject: "s",
      html: "b",
    });

    expect(result.delivered).toBe(false);
    expect(result.error).toBe("network_error");
  });

  it("sendInviteEmail builds an accept link with the invite token", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    vi.stubEnv("APP_URL", "https://app.example.com");
    const { sendInviteEmail } = await import("@/lib/email");

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}", { status: 200 }));

    const result = await sendInviteEmail({
      to: "new.member@example.com",
      workspaceName: "Toko Kopi <Brand>",
      role: "operator",
      token: "abc123token",
    });

    expect(result.delivered).toBe(true);
    const init = fetchSpy.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(init.body as string);
    expect(body.subject).toContain("Toko Kopi");
    // workspace name is HTML-escaped in the body
    expect(body.html).toContain("Toko Kopi &lt;Brand&gt;");
    expect(body.html).toContain("https://app.example.com/invite/abc123token");
    expect(body.text).toContain("https://app.example.com/invite/abc123token");
  });
});
