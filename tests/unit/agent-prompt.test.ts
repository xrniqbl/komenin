import { describe, expect, it } from "vitest";
import { buildAgentSystemPrompt } from "@/lib/ai/agent-prompt";
import { normalizeKind, defaultBaseForKind } from "@/lib/ai/config";

describe("buildAgentSystemPrompt", () => {
  it("includes personality characteristics", () => {
    const prompt = buildAgentSystemPrompt({
      name: "Sales Bot",
      tone: "casual",
      language: "id",
      systemPrompt: "Base prompt",
      style: "concise",
      formality: "casual",
      emojiPolicy: "none",
      ctaStyle: "soft",
      maxSentences: 2,
      bannedTopics: ["judi"],
      mustInclude: ["Komenin"],
    });
    expect(prompt).toContain("Base prompt");
    expect(prompt).toContain("Language: id");
    expect(prompt).toContain("Tone: casual");
    expect(prompt).toContain("Style: concise");
    expect(prompt).toContain("Never mention: judi");
    expect(prompt).toContain("include: Komenin");
  });
});

describe("ai provider kind helpers", () => {
  it("normalizes provider kinds", () => {
    expect(normalizeKind("9Router")).toBe("ninerouter");
    expect(normalizeKind("OpenAI")).toBe("openai");
    expect(normalizeKind("claude")).toBe("anthropic");
    expect(normalizeKind("custom")).toBe("openai_compatible");
  });

  it("defaults bases for known kinds", () => {
    expect(defaultBaseForKind("openai")).toContain("api.openai.com");
    expect(defaultBaseForKind("anthropic")).toContain("api.anthropic.com");
  });
});
