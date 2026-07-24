import { describe, expect, it } from "vitest";
import { evaluateSsoReadiness } from "@/lib/sso-readiness";

describe("evaluateSsoReadiness", () => {
  it("never claims production login readiness today", () => {
    const prod = evaluateSsoReadiness({
      isProduction: true,
      allowSecurityStubs: false,
      enforceLogin: false,
    });
    expect(prod.readyForProductionLogin).toBe(false);
    expect(prod.signatureValidationImplemented).toBe(false);
    expect(prod.blockers.length).toBeGreaterThan(0);
  });

  it("notes unsigned dev path when stubs allowed", () => {
    const dev = evaluateSsoReadiness({
      isProduction: false,
      allowSecurityStubs: true,
      enforceLogin: false,
    });
    expect(dev.unsignedDevAllowed).toBe(true);
    expect(dev.notes.some((n) => n.toLowerCase().includes("unsigned"))).toBe(true);
  });
});
