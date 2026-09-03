import { describe, expect, it, afterEach } from "vitest";
import {
  costPerCreditIdr,
  estimateCostIdr,
  DEFAULT_COST_PER_CREDIT_IDR,
} from "@/lib/ai/cost";

afterEach(() => {
  delete process.env.AI_MODEL_COST_IDR;
});

describe("AI model cost table", () => {
  it("returns known model costs from the default table (current-gen models)", () => {
    expect(costPerCreditIdr("gpt-4o-mini")).toBe(0.003);
    expect(costPerCreditIdr("gpt-4o")).toBe(0.04);
    expect(costPerCreditIdr("deepseek-v3.2")).toBe(0.004);
    expect(costPerCreditIdr("claude-sonnet-4.5")).toBe(0.05);
    expect(costPerCreditIdr("deepseek-r1")).toBe(0.009);
  });

  it("falls back to the default rate for unknown models (never reads as free)", () => {
    expect(costPerCreditIdr("some-unmapped-premium-model")).toBe(
      DEFAULT_COST_PER_CREDIT_IDR,
    );
  });

  it("respects the env override", () => {
    process.env.AI_MODEL_COST_IDR = JSON.stringify({ "gpt-4o-mini": 0.01 });
    expect(costPerCreditIdr("gpt-4o-mini")).toBe(0.01);
  });

  it("ignores malformed env JSON and uses defaults", () => {
    process.env.AI_MODEL_COST_IDR = "{not valid json";
    expect(costPerCreditIdr("gpt-4o-mini")).toBe(0.003);
  });

  it("estimates cost from credits", () => {
    expect(estimateCostIdr("gpt-4o", 1_000_000)).toBe(40_000);
    expect(estimateCostIdr("gpt-4o", 1_000_000n)).toBe(40_000);
    expect(estimateCostIdr("deepseek-v3.2", 1_000_000)).toBe(4_000);
  });
});
