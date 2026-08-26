import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("email module (Brevo)", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("isEmailConfigured requires both BREVO_API_KEY and EMAIL_FROM", async () => {
    vi.stubEnv("BREVO_API_KEY", "");
    vi.stubEnv("EMAIL_FROM", "noreply@brand.id");
    const { isEmailConfigured } = await import("@/lib/email");
    expect(isEmailConfigured()).toBe(false);

    vi.stubEnv("BREVO_API_KEY", "xkeysib-test");
    const fresh = await import("@/lib/email");
    expect(fresh.isEmailConfigured()).toBe(true);
  });

  it("sendEmail no-ops (delivered:false) when not configured", async () => {
    vi.stubEnv("BREVO_API_KEY", "");
    vi.stubEnv("EMAIL_FROM", "noreply@brand.id");
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

  it("sendEmail posts to Brevo v3 with api-key header and sender object", async () => {
    vi.stubEnv("BREVO_API_KEY", "xkeysib-test");
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
    expect(result.provider).toBe("brevo");

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.brevo.com/v3/smtp/email");
    const headers = init.headers as Record<string, string>;
    expect(headers["api-key"]).toBe("xkeysib-test");
    expect(headers["content-type"]).toBe("application/json");

    const body = JSON.parse(init.body as string);
    expect(body.sender).toEqual({ email: "noreply@brand.id", name: "Aether" });
    expect(body.to).toEqual([{ email: "member@example.com" }]);
    expect(body.subject).toBe("You're invited");
    expect(body.htmlContent).toContain("Join us");
    expect(body.textContent).toBe("Join us");
  });

  it("supports a bare EMAIL_FROM address without a display name", async () => {
    vi.stubEnv("BREVO_API_KEY", "xkeysib-test");
    vi.stubEnv("EMAIL_FROM", "noreply@brand.id");
    const { sendEmail } = await import("@/lib/email");

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}", { status: 200 }));

    await sendEmail({ to: "x@example.com", subject: "s", html: "b" });

    const init = fetchSpy.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(init.body as string);
    expect(body.sender).toEqual({ email: "noreply@brand.id" });
  });

  it("sendEmail never throws on provider rejection", async () => {
    vi.stubEnv("BREVO_API_KEY", "xkeysib-test");
    vi.stubEnv("EMAIL_FROM", "noreply@brand.id");
    const { sendEmail } = await import("@/lib/email");

    vi.spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("invalid sender", { status: 400 }));

    const result = await sendEmail({
      to: "x@example.com",
      subject: "s",
      html: "b",
    });

    expect(result.delivered).toBe(false);
    expect(result.error).toBe("brevo_400");
    expect(console.warn).toHaveBeenCalled();
  });

  it("sendEmail never throws on network failure", async () => {
    vi.stubEnv("BREVO_API_KEY", "xkeysib-test");
    vi.stubEnv("EMAIL_FROM", "noreply@brand.id");
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
    vi.stubEnv("BREVO_API_KEY", "xkeysib-test");
    vi.stubEnv("EMAIL_FROM", "Aether <noreply@brand.id>");
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
    expect(body.htmlContent).toContain("Toko Kopi &lt;Brand&gt;");
    expect(body.htmlContent).toContain("https://app.example.com/invite/abc123token");
    expect(body.textContent).toContain("https://app.example.com/invite/abc123token");
  });
});
