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

  it("uses a fresh IV per encryption", () => {
    const a = encryptSecret("same-input");
    const b = encryptSecret("same-input");
    expect(a).not.toBe(b);
  });

  it("rejects a truncated GCM auth tag", () => {
    const [version, iv, tag, data] = encryptSecret("secret").split(":");
    const shortTag = tag.slice(0, 8); // 4 bytes instead of 16
    expect(() => decryptSecret(`${version}:${iv}:${shortTag}:${data}`)).toThrow(
      /Invalid encrypted payload/,
    );
  });

  it("rejects a tampered ciphertext", () => {
    const [version, iv, tag, data] = encryptSecret("secret").split(":");
    const flipped = (parseInt(data.slice(0, 2), 16) ^ 0xff)
      .toString(16)
      .padStart(2, "0");
    const tampered = `${version}:${iv}:${tag}:${flipped}${data.slice(2)}`;
    expect(() => decryptSecret(tampered)).toThrow();
  });
});
