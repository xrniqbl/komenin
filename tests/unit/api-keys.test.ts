import { afterEach, describe, expect, it, vi } from "vitest";
import {
  generateApiKey,
  hashApiKey,
  hashApiKeyVariants,
  isValidScope,
  legacyHashApiKey,
} from "@/lib/api-keys";

afterEach(() => {
  vi.unstubAllEnvs();
});

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

  it("hashes identically without pepper (legacy scheme)", () => {
    vi.stubEnv("API_KEY_PEPPER", "");
    const raw = "aeth_testkey123";
    expect(hashApiKey(raw)).toBe(legacyHashApiKey(raw));
    expect(hashApiKeyVariants(raw)).toEqual([legacyHashApiKey(raw)]);
  });

  it("wraps the digest in HMAC when a pepper is set and keeps the legacy variant", () => {
    vi.stubEnv("API_KEY_PEPPER", "unit-test-pepper");
    const raw = "aeth_testkey123";
    const peppered = hashApiKey(raw);
    expect(peppered).not.toBe(legacyHashApiKey(raw));
    expect(peppered.length).toBe(64);
    expect(hashApiKeyVariants(raw)).toEqual([peppered, legacyHashApiKey(raw)]);
    expect(hashApiKey(raw)).toBe(hashApiKey(raw)); // still deterministic
  });
});
