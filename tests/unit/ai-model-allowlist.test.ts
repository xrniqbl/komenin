import { describe, expect, it, afterEach } from "vitest";
import {
  allowedModelsForTier,
  filterModelsForTier,
  isModelAllowedForTier,
} from "@/lib/ai/models";

const ENV_KEYS = [
  "KOMENIN_AI_MODELS_STARTER",
  "KOMENIN_AI_MODELS_PRO",
  "KOMENIN_AI_MODELS_PRO_MAX",
] as const;

afterEach(() => {
  for (const key of ENV_KEYS) delete process.env[key];
});

describe("model allowlist per tier", () => {
  it("BYOK (none) is unrestricted", () => {
    expect(allowedModelsForTier("none")).toBeNull();
    expect(isModelAllowedForTier("none", "anything-goes")).toBe(true);
  });

  it("starter gets economic models only (incl. latest Chinese models)", () => {
    expect(isModelAllowedForTier("starter", "gpt-4o-mini")).toBe(true);
    expect(isModelAllowedForTier("starter", "deepseek-v3.2")).toBe(true);
    expect(isModelAllowedForTier("starter", "glm-4.6-flash")).toBe(true);
    expect(isModelAllowedForTier("starter", "gpt-4o")).toBe(false);
    expect(isModelAllowedForTier("starter", "claude-sonnet-4.5")).toBe(false);
  });

  it("pro adds standard models", () => {
    expect(isModelAllowedForTier("pro", "gpt-4o-mini")).toBe(true);
    expect(isModelAllowedForTier("pro", "deepseek-v3.2")).toBe(true);
    expect(isModelAllowedForTier("pro", "gpt-4o")).toBe(true);
    expect(isModelAllowedForTier("pro", "kimi-k2")).toBe(true);
    expect(isModelAllowedForTier("pro", "glm-4.6")).toBe(true);
    expect(isModelAllowedForTier("pro", "o1")).toBe(false);
  });

  it("pro_max allows premium models", () => {
    expect(isModelAllowedForTier("pro_max", "gpt-4o-mini")).toBe(true);
    expect(isModelAllowedForTier("pro_max", "gpt-4o")).toBe(true);
    expect(isModelAllowedForTier("pro_max", "o1")).toBe(true);
    expect(isModelAllowedForTier("pro_max", "claude-sonnet-4.5")).toBe(true);
    expect(isModelAllowedForTier("pro_max", "deepseek-r1")).toBe(true);
    expect(isModelAllowedForTier("pro_max", "gemini-2.5-pro")).toBe(true);
  });

  it("respects env overrides without a redeploy", () => {
    process.env.KOMENIN_AI_MODELS_STARTER = "cheap-a,cheap-b";
    expect(allowedModelsForTier("starter")).toEqual(["cheap-a", "cheap-b"]);
    expect(isModelAllowedForTier("starter", "gpt-4o-mini")).toBe(false);
    expect(isModelAllowedForTier("starter", "cheap-a")).toBe(true);
  });

  it("filterModelsForTier preserves order and drops disallowed", () => {
    expect(
      filterModelsForTier("starter", ["gpt-4o", "gpt-4o-mini", "o1"]),
    ).toEqual(["gpt-4o-mini"]);
    expect(filterModelsForTier("none", ["a", "b"])).toEqual(["a", "b"]);
  });
});
