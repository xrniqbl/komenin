import { describe, expect, it } from "vitest";
import { chunkText, rankChunks, tokenize } from "@/lib/knowledge/retrieve";

describe("knowledge retrieval", () => {
  it("chunks long text", () => {
    const chunks = chunkText("Alpha paragraph.\n\nBeta paragraph about coupons and pricing.\n\nGamma.");
    expect(chunks.length).toBeGreaterThan(0);
    expect(tokenize(chunks[0]).length).toBeGreaterThan(0);
  });

  it("ranks relevant chunks higher", () => {
    const ranked = rankChunks("coupon promo diskon", [
      { id: "1", content: "Our office is in Jakarta" },
      { id: "2", content: "Gunakan coupon AETHER10 untuk promo diskon" },
      { id: "3", content: "Support hours are 9 to 5" },
    ], 2);
    expect(ranked[0].id).toBe("2");
  });
});
