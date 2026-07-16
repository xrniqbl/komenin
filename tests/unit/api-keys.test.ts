import { describe, expect, it } from "vitest";
import { generateApiKey, hashApiKey, isValidScope } from "@/lib/api-keys";

describe("api-keys", () => {
  it("generates key with prefix and hash", () => {
    const { raw, prefix, hashed } = generateApiKey();
    expect(raw.startsWith("aeth_")).toBe(true);
    expect(prefix).toBe(raw.slice(0, 12));
    expect(hashed.length).toBe(64); // sha256 hex
  });

  it("hashing is deterministic", () => {
    const raw = "aeth_testkey123";
    expect(hashApiKey(raw)).toBe(hashApiKey(raw));
  });

  it("different keys have different hashes", () => {
    const a = generateApiKey();
    const b = generateApiKey();
    expect(a.hashed).not.toBe(b.hashed);
    expect(a.raw).not.toBe(b.raw);
  });

  it("validates scopes", () => {
    expect(isValidScope("campaigns:read")).toBe(true);
    expect(isValidScope("accounts:read")).toBe(true);
    expect(isValidScope("invalid:scope")).toBe(false);
  });
});
