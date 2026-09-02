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

  it("starter gets economic models only", () => {
    expect(isModelAllowedForTier("starter", "gpt-4o-mini")).toBe(true);
    expect(isModelAllowedForTier("starter", "gpt-4o")).toBe(false);
    expect(isModelAllowedForTier("starter", "claude-3-5-sonnet")).toBe(false);
  });

  it("pro adds standard models", () => {
    expect(isModelAllowedForTier("pro", "gpt-4o-mini")).toBe(true);
    expect(isModelAllowedForTier("pro", "gpt-4o")).toBe(true);
    expect(isModelAllowedForTier("pro", "o1")).toBe(false);
  });

  it("pro_max allows premium models", () => {
    expect(isModelAllowedForTier("pro_max", "gpt-4o-mini")).toBe(true);
    expect(isModelAllowedForTier("pro_max", "gpt-4o")).toBe(true);
    expect(isModelAllowedForTier("pro_max", "o1")).toBe(true);
    expect(isModelAllowedForTier("pro_max", "claude-3-5-sonnet")).toBe(true);
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
