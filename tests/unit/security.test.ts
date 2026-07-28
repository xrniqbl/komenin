import { afterEach, describe, expect, it, vi } from "vitest";
import { allowDevStubs, isProductionRuntime, safeEqual } from "@/lib/security";

describe("security", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("safeEqual", () => {
    it("matches equal strings and rejects mismatches/lengths", () => {
      expect(safeEqual("token-abc", "token-abc")).toBe(true);
      expect(safeEqual("token-abc", "token-xyz")).toBe(false);
      expect(safeEqual("short", "longer-value")).toBe(false);
    });
  });

  describe("isProductionRuntime", () => {
    it("is true when NODE_ENV=production", () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("VERCEL_ENV", "");
      expect(isProductionRuntime()).toBe(true);
    });

    it("treats Vercel preview/staging as production (locked down)", () => {
      vi.stubEnv("NODE_ENV", "development");
      vi.stubEnv("VERCEL_ENV", "preview");
      expect(isProductionRuntime()).toBe(true);
    });

    it("is false only for genuine local development", () => {
      vi.stubEnv("NODE_ENV", "development");
      vi.stubEnv("VERCEL_ENV", "development");
      expect(isProductionRuntime()).toBe(false);
    });
  });

  describe("allowDevStubs", () => {
    it("is never enabled in a production-like runtime", () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("ALLOW_SECURITY_STUBS", "true");
      expect(allowDevStubs()).toBe(false);
    });

    it("requires explicit opt-in even in development", () => {
      vi.stubEnv("NODE_ENV", "development");
      vi.stubEnv("VERCEL_ENV", "development");
      vi.stubEnv("ALLOW_SECURITY_STUBS", "");
      vi.stubEnv("SIMULATOR_MODE", "true");
      // SIMULATOR_MODE=true must NOT silently enable insecure stubs.
      expect(allowDevStubs()).toBe(false);
    });

    it("enables stubs only with the explicit flag in development", () => {
      vi.stubEnv("NODE_ENV", "development");
      vi.stubEnv("VERCEL_ENV", "development");
      vi.stubEnv("ALLOW_SECURITY_STUBS", "true");
      expect(allowDevStubs()).toBe(true);
    });
  });
});
