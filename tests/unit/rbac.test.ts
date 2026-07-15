import { describe, expect, it } from "vitest";
import { can } from "@/lib/rbac";

describe("can", () => {
  it("allows owner to manage billing", () => {
    expect(can("owner", "billing.manage")).toBe(true);
  });

  it("denies operator billing management", () => {
    expect(can("operator", "billing.manage")).toBe(false);
  });

  it("allows operator to manage campaigns", () => {
    expect(can("operator", "campaigns.manage")).toBe(true);
  });

  it("allows auditor to view audit logs", () => {
    expect(can("auditor", "audit.view")).toBe(true);
    expect(can("viewer", "audit.view")).toBe(false);
  });
});
