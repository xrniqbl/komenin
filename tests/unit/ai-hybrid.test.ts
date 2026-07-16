import { describe, expect, it } from "vitest";
import { generateContextualComment } from "@/lib/comment-engine";

describe("hybrid comment engine", () => {
  it("keeps local fallback generation", () => {
    const result = generateContextualComment({
      postContent: "Kami lagi cari tools otomasi komentar yang aman.",
      goal: "edukasi produk",
      tone: "professional",
    });
    expect(result.content.length).toBeGreaterThan(20);
    expect(result.source).toBe("local_fallback");
  });

  it("flags banned topics in local mode", () => {
    const result = generateContextualComment({
      postContent: "Promosi judi online",
      goal: "awareness",
      tone: "casual",
    });
    expect(result.riskFlags.length).toBeGreaterThan(0);
  });
});