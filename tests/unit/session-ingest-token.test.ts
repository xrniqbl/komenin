import { beforeAll, describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import {
  INGEST_ALLOWED_ORIGINS,
  ingestCorsHeaders,
  signSessionIngestToken,
  verifySessionIngestToken,
} from "@/lib/session-ingest-token";

/**
 * The ingest bridge is reachable from the platform origin without a session
 * cookie, so the pairing token is the ONLY thing standing between an
 * anonymous caller and "write encrypted cookies into a workspace". These
 * tests cover the forgery and expiry surface.
 */

beforeAll(() => {
  process.env.SESSION_INGEST_SECRET = "unit-test-secret-please-rotate";
});

const OWNER = { userId: "user_1", workspaceId: "ws_1", platform: "instagram" as const };

describe("signSessionIngestToken / verifySessionIngestToken", () => {
  it("round-trips a valid token", () => {
    const token = signSessionIngestToken(OWNER);
    const payload = verifySessionIngestToken(token);
    expect(payload).not.toBeNull();
    expect(payload?.userId).toBe("user_1");
    expect(payload?.workspaceId).toBe("ws_1");
    expect(payload?.platform).toBe("instagram");
  });

  it("issues a short-lived token", () => {
    const payload = verifySessionIngestToken(signSessionIngestToken(OWNER));
    const ttlSeconds = (payload?.exp ?? 0) - Math.floor(Date.now() / 1000);
    expect(ttlSeconds).toBeGreaterThan(0);
    expect(ttlSeconds).toBeLessThanOrEqual(10 * 60);
  });

  it("produces a fresh nonce per token", () => {
    const a = verifySessionIngestToken(signSessionIngestToken(OWNER));
    const b = verifySessionIngestToken(signSessionIngestToken(OWNER));
    expect(a?.nonce).not.toBe(b?.nonce);
  });

  it("rejects a tampered body", () => {
    const token = signSessionIngestToken(OWNER);
    const [body, sig] = token.split(".");
    const forged = Buffer.from(
      JSON.stringify({ ...OWNER, workspaceId: "ws_VICTIM", nonce: "x", exp: 9_999_999_999 }),
    )
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    expect(verifySessionIngestToken(`${forged}.${sig}`)).toBeNull();
    expect(forged).not.toBe(body);
  });

  it("rejects a tampered signature", () => {
    const token = signSessionIngestToken(OWNER);
    const [body] = token.split(".");
    expect(verifySessionIngestToken(`${body}.AAAA${"a".repeat(60)}`)).toBeNull();
  });

  it("rejects a signature of the wrong length", () => {
    const token = signSessionIngestToken(OWNER);
    const [body] = token.split(".");
    expect(verifySessionIngestToken(`${body}.short`)).toBeNull();
  });

  it("rejects malformed input", () => {
    expect(verifySessionIngestToken("")).toBeNull();
    expect(verifySessionIngestToken("no-dot")).toBeNull();
    expect(verifySessionIngestToken(".")).toBeNull();
    expect(verifySessionIngestToken("a.")).toBeNull();
  });

  it("rejects a token signed with a different secret", () => {
    const token = signSessionIngestToken(OWNER);
    const previous = process.env.SESSION_INGEST_SECRET;
    process.env.SESSION_INGEST_SECRET = "a-different-secret-entirely";
    try {
      expect(verifySessionIngestToken(token)).toBeNull();
    } finally {
      process.env.SESSION_INGEST_SECRET = previous;
    }
  });

  it("rejects an expired token", () => {
    const token = signSessionIngestToken(OWNER);
    const [body] = token.split(".");
    const pad = body.length % 4 === 0 ? "" : "=".repeat(4 - (body.length % 4));
    const payload = JSON.parse(
      Buffer.from(body.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64").toString("utf8"),
    ) as { exp: number };
    const past = { ...payload, exp: Math.floor(Date.now() / 1000) - 60 };
    const forgedBody = Buffer.from(JSON.stringify(past))
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    // Re-sign with the correct secret so only the expiry check can reject it.
    const sig = createHmac("sha256", process.env.SESSION_INGEST_SECRET as string)
      .update(forgedBody)
      .digest()
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    expect(verifySessionIngestToken(`${forgedBody}.${sig}`)).toBeNull();
  });
});

describe("ingestCorsHeaders", () => {
  it("echoes an allow-listed platform origin", () => {
    for (const origin of INGEST_ALLOWED_ORIGINS) {
      expect(ingestCorsHeaders(origin)["access-control-allow-origin"]).toBe(origin);
    }
  });

  it("never uses a wildcard", () => {
    expect(ingestCorsHeaders("https://www.instagram.com")["access-control-allow-origin"]).not.toBe(
      "*",
    );
  });

  it("omits the allow-origin header for a hostile origin", () => {
    const headers = ingestCorsHeaders("https://evil.example");
    expect(headers["access-control-allow-origin"]).toBeUndefined();
    expect(headers.vary).toBe("Origin");
  });

  it("omits the allow-origin header when the origin is absent", () => {
    expect(ingestCorsHeaders(null)["access-control-allow-origin"]).toBeUndefined();
  });

  it("declares POST + OPTIONS only", () => {
    expect(ingestCorsHeaders("https://www.threads.net")["access-control-allow-methods"]).toBe(
      "POST, OPTIONS",
    );
  });
});
