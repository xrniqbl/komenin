import { describe, expect, it } from "vitest";
import { matchSkillsForText, type SkillRecord } from "@/lib/skills/runtime";

describe("skill triggers", () => {
  it("matches skills by trigger patterns", () => {
    const skills: SkillRecord[] = [
      {
        id: "1",
        workspaceId: "w",
        name: "Coupon",
        slug: "coupon-lookup",
        description: null,
        executor: "builtin",
        configJson: {},
        highRisk: false,
        isActive: true,
        triggers: [{ id: "t1", pattern: "coupon" }],
      },
      {
        id: "2",
        workspaceId: "w",
        name: "FAQ",
        slug: "brand-faq",
        description: null,
        executor: "builtin",
        configJson: {},
        highRisk: false,
        isActive: true,
        triggers: [{ id: "t2", pattern: "harga" }],
      },
    ];

    const matched = matchSkillsForText("Ada coupon buat trial?", skills);
    expect(matched.map((s) => s.slug)).toEqual(["coupon-lookup"]);
  });
});
