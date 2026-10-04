import { describe, expect, it } from "vitest";
import {
  CAMPAIGN_TEMPLATES,
  getTemplateById,
  getTemplatesByPlatform,
  getTemplateCategories,
} from "@/data/onboarding-templates";

describe("onboarding-templates", () => {
  it("exports at least one template per supported platform", () => {
    const platforms = ["instagram", "tiktok", "threads"] as const;
    for (const platform of platforms) {
      const templates = getTemplatesByPlatform(platform);
      expect(templates.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("every template has a unique id", () => {
    const ids = CAMPAIGN_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("getTemplateById returns correct template", () => {
    const first = CAMPAIGN_TEMPLATES[0];
    const found = getTemplateById(first.id);
    expect(found).toBeDefined();
    expect(found?.name).toBe(first.name);
  });

  it("getTemplateById returns undefined for unknown id", () => {
    expect(getTemplateById("nonexistent")).toBeUndefined();
  });

  it("every template has valid delay ranges", () => {
    for (const t of CAMPAIGN_TEMPLATES) {
      expect(t.minDelaySec).toBeGreaterThan(0);
      expect(t.maxDelaySec).toBeGreaterThanOrEqual(t.minDelaySec);
      expect(t.dailyLimit).toBeGreaterThan(0);
    }
  });

  it("getTemplateCategories returns all four categories", () => {
    const categories = getTemplateCategories();
    expect(categories).toHaveLength(4);
    const values = categories.map((c) => c.value);
    expect(values).toContain("engagement");
    expect(values).toContain("leads");
    expect(values).toContain("brand");
    expect(values).toContain("support");
  });
});
