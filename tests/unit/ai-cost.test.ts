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
  it("returns known model costs from the default table", () => {
    expect(costPerCreditIdr("gpt-4o-mini")).toBe(0.03);
    expect(costPerCreditIdr("gpt-4o")).toBe(0.18);
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
    expect(costPerCreditIdr("gpt-4o-mini")).toBe(0.03);
  });

  it("estimates cost from credits", () => {
    expect(estimateCostIdr("gpt-4o", 1_000_000)).toBe(180_000);
    expect(estimateCostIdr("gpt-4o", 1_000_000n)).toBe(180_000);
  });
});
