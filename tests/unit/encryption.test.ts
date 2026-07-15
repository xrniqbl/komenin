import { beforeAll, describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "@/lib/encryption";

describe("encryption", () => {
  beforeAll(() => {
    process.env.ENCRYPTION_KEY =
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  });

  it("round-trips secrets", () => {
    const encrypted = encryptSecret("cookie-value");
    expect(encrypted).not.toContain("cookie-value");
    expect(decryptSecret(encrypted)).toBe("cookie-value");
  });
});
