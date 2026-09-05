import { afterEach, describe, expect, it } from "vitest";
import { consumeSsoTicket, signSsoTicket, verifySsoTicket } from "@/lib/sso-ticket";
import { parseSamlResponse, isAssertionTimeValid } from "@/lib/saml/parse";

const original = process.env.AUTH_SECRET;

afterEach(() => {
  if (original === undefined) delete process.env.AUTH_SECRET;
  else process.env.AUTH_SECRET = original;
});

describe("sso-ticket", () => {
  it("signs and verifies tickets", () => {
    process.env.AUTH_SECRET = "test-auth-secret-16chars";
    const ticket = signSsoTicket({
      userId: "user_1",
      workspaceId: "ws_1",
      email: "a@example.com",
    });
    const payload = verifySsoTicket(ticket);
    expect(payload?.userId).toBe("user_1");
    expect(payload?.workspaceId).toBe("ws_1");
    expect(payload?.email).toBe("a@example.com");
  });

  it("rejects tampered tickets", () => {
    process.env.AUTH_SECRET = "test-auth-secret-16chars";
    const ticket = signSsoTicket({
      userId: "user_1",
      workspaceId: "ws_1",
      email: "a@example.com",
    });
    expect(verifySsoTicket(`${ticket}x`)).toBeNull();
  });

  it("consumes tickets single-use", () => {
    process.env.AUTH_SECRET = "test-auth-secret-16chars";
    const ticket = signSsoTicket({
      userId: "user_1",
      workspaceId: "ws_1",
      email: "a@example.com",
    });
    const first = consumeSsoTicket(ticket);
    expect(first?.userId).toBe("user_1");
    // Replay of the same ticket must be rejected inside the TTL window.
    expect(consumeSsoTicket(ticket)).toBeNull();
    // Verify-only still succeeds, but consumption stays blocked.
    expect(verifySsoTicket(ticket)?.userId).toBe("user_1");
    expect(consumeSsoTicket(ticket)).toBeNull();
  });
});

describe("saml parse", () => {
  it("extracts email from NameID in base64 SAMLResponse", () => {
    const xml = `<?xml version="1.0"?>
      <samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">
        <saml:Issuer>https://idp.example.com</saml:Issuer>
        <saml:Assertion>
          <saml:Subject><saml:NameID>jane@acme.com</saml:NameID></saml:Subject>
          <saml:Conditions NotOnOrAfter="2099-01-01T00:00:00Z"/>
        </saml:Assertion>
      </samlp:Response>`;
    const b64 = Buffer.from(xml, "utf8").toString("base64");
    const parsed = parseSamlResponse(b64);
    expect(parsed.email).toBe("jane@acme.com");
    expect(parsed.issuer).toBe("https://idp.example.com");
    expect(isAssertionTimeValid(parsed.notOnOrAfter)).toBe(true);
  });
});
