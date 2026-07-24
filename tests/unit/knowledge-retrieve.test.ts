import { describe, expect, it } from "vitest";
import { rankChunks, tokenize } from "@/lib/knowledge/retrieve";

describe("knowledge retrieve", () => {
  it("tokenizes and drops short/stop words", () => {
    const tokens = tokenize("The brand voice for this product is calm and precise");
    expect(tokens).toContain("brand");
    expect(tokens).toContain("voice");
    expect(tokens).not.toContain("the");
    expect(tokens).not.toContain("and");
  });

  it("ranks the most relevant chunk first", () => {
    const ranked = rankChunks(
      "refund policy for annual plan",
      [
        { id: "1", content: "Our office is open on weekdays in Jakarta." },
        {
          id: "2",
          content:
            "Annual plan refund policy: customers can request a prorated refund within 14 days.",
        },
        { id: "3", content: "Shipping takes 3-5 business days for physical goods." },
      ],
      2,
    );
    expect(ranked[0]?.id).toBe("2");
    expect(ranked[0]!.score).toBeGreaterThan(ranked[1]?.score || 0);
  });
});
