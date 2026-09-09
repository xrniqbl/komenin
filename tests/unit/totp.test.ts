import { describe, expect, it } from "vitest";
import {
  base32Decode,
  base32Encode,
  generateTotpSecret,
  otpauthUri,
  totpAt,
  verifyTotp,
} from "@/lib/totp";

// RFC 6238 Appendix B test vectors (SHA-1, T0=0, step 30s).
// Secret is base32 of ASCII "12345678901234567890".
const RFC_SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

describe("totp", () => {
  it("round-trips base32", () => {
    const bytes = Buffer.from([0, 1, 2, 250, 251, 255, 77]);
    expect(base32Decode(base32Encode(bytes)).equals(bytes)).toBe(true);
    expect(base32Encode(Buffer.from("12345678901234567890", "ascii"))).toBe(
      RFC_SECRET,
    );
  });

  it("matches RFC 6238 SHA-1 test vectors", () => {
    expect(totpAt(RFC_SECRET, 59_000)).toBe("287082");
    expect(totpAt(RFC_SECRET, 1111111109_000)).toBe("081804");
    expect(totpAt(RFC_SECRET, 1234567890_000)).toBe("005924");
    expect(totpAt(RFC_SECRET, 2000000000_000)).toBe("279037");
    expect(totpAt(RFC_SECRET, 20000000000_000)).toBe("353130");
  });

  it("verifies the current code and tolerates ±1 step of drift", () => {
    const t = 59_000;
    expect(verifyTotp(RFC_SECRET, "287082", { timestampMs: t })).toBe(1);
    // Two steps ahead is outside the ±1 window and must fail.
    expect(verifyTotp(RFC_SECRET, totpAt(RFC_SECRET, t + 60_000), { timestampMs: t })).toBeNull();
    // The ±1 window accepts the neighbouring step's code.
    expect(verifyTotp(RFC_SECRET, totpAt(RFC_SECRET, t - 30_000), { timestampMs: t })).toBe(0);
    expect(verifyTotp(RFC_SECRET, totpAt(RFC_SECRET, t + 30_000), { timestampMs: t })).toBe(2);
  });

  it("returns the matched step so callers can reject reused (replayed) codes", () => {
    const t = 59_000;
    const step = verifyTotp(RFC_SECRET, "287082", { timestampMs: t });
    expect(step).not.toBeNull();
    // The same code maps to the same step — the server layer must reject any
    // verify whose step is ≤ the last successfully used step.
    expect(verifyTotp(RFC_SECRET, "287082", { timestampMs: t })).toBe(step);
  });

  it("rejects malformed or wrong codes", () => {
    expect(verifyTotp(RFC_SECRET, "28708", { timestampMs: 59_000 })).toBeNull();
    expect(verifyTotp(RFC_SECRET, "2870821", { timestampMs: 59_000 })).toBeNull();
    expect(verifyTotp(RFC_SECRET, "abcdef", { timestampMs: 59_000 })).toBeNull();
    expect(verifyTotp(RFC_SECRET, "", { timestampMs: 59_000 })).toBeNull();
    // Normalizes spaces/dashes typed by users.
    expect(verifyTotp(RFC_SECRET, "287-082", { timestampMs: 59_000 })).not.toBeNull();
  });

  it("generates distinct 160-bit secrets", () => {
    const a = generateTotpSecret();
    const b = generateTotpSecret();
    expect(a).not.toBe(b);
    expect(base32Decode(a).length).toBe(20);
  });

  it("builds an otpauth URI authenticator apps accept", () => {
    const uri = otpauthUri({
      secret: RFC_SECRET,
      email: "a@example.com",
      issuer: "Komenin",
    });
    expect(uri.startsWith("otpauth://totp/Komenin%3Aa%40example.com?")).toBe(true);
    expect(uri).toContain(`secret=${RFC_SECRET}`);
    expect(uri).toContain("digits=6");
    expect(uri).toContain("period=30");
  });
});
