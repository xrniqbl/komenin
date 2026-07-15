import { describe, expect, it } from "vitest";
import { generateContextualComment, pickDelaySeconds } from "@/lib/comment-engine";

describe("comment-engine", () => {
  it("generates contextual non-empty comment", () => {
    const result = generateContextualComment({
      postContent: "Kami lagi cari tools otomasi komentar yang aman.",
      goal: "edukasi produk",
      tone: "professional",
    });
    expect(result.content.length).toBeGreaterThan(20);
    expect(result.riskFlags).toEqual([]);
  });

  it("flags banned topics", () => {
    const result = generateContextualComment({
      postContent: "Promosi judi online",
      goal: "awareness",
      tone: "casual",
    });
    expect(result.riskFlags.length).toBeGreaterThan(0);
  });

  it("picks delay within bounds", () => {
    const delay = pickDelaySeconds(10, 20);
    expect(delay).toBeGreaterThanOrEqual(10);
    expect(delay).toBeLessThanOrEqual(20);
  });
});
