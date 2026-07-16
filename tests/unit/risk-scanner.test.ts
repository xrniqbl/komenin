import { describe, expect, it } from "vitest";
import { scanContentRisk } from "@/lib/risk-scanner";

describe("risk-scanner", () => {
  it("detects banned phrase", () => {
    const result = scanContentRisk({ text: "Promosi judi online terbaik" });
    expect(result.flags.length).toBeGreaterThan(0);
    expect(result.blocked).toBe(true);
  });

  it("detects promo claim", () => {
    const result = scanContentRisk({ text: "Dapatkan cuan instan kaya cepat tanpa modal!" });
    const hasPromo = result.details.some((f) => f.type === "promo_claim");
    expect(hasPromo).toBe(true);
  });

  it("clean text is not blocked", () => {
    const result = scanContentRisk({ text: "Terima kasih sudah berbagi insight yang relevan." });
    expect(result.blocked).toBe(false);
    expect(result.riskScore).toBeLessThan(0.5);
  });

  it("scores high correctly", () => {
    const result = scanContentRisk({ text: "judi scam ponzi gratis 100% dijamin untung" });
    expect(result.riskScore).toBeGreaterThanOrEqual(0.8);
    expect(result.blocked).toBe(true);
  });

  it("custom rule matching works", () => {
    const result = scanContentRisk({
      text: "Investasi bodong harus dihindari",
      customRules: [
        { id: "1", type: "banned_phrase", pattern: "investasi bodong", severity: "high", isActive: true },
      ],
    });
    expect(result.flags.length).toBeGreaterThan(0);
    expect(result.blocked).toBe(true);
  });

  it("regex custom rule works", () => {
    const result = scanContentRisk({
      text: "Skema cepat kaya dalam 7 hari",
      customRules: [
        { id: "2", type: "custom", pattern: "/cepat\\s*kaya/i", severity: "medium", isActive: true },
      ],
    });
    expect(result.flags.length).toBeGreaterThan(0);
  });
});
