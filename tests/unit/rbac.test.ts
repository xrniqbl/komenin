import { describe, expect, it } from "vitest";
import {
  assertCanWithCustom,
  assertWorkspacePermission,
  can,
  canWithCustom,
} from "@/lib/rbac";

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

describe("canWithCustom", () => {
  it("grants permission when listed in custom permissions", () => {
    expect(
      canWithCustom("viewer", ["campaigns.manage", "analytics.view"], "campaigns.manage"),
    ).toBe(true);
  });

  it("denies permission when not listed in custom permissions", () => {
    expect(
      canWithCustom("viewer", ["analytics.view"], "campaigns.manage"),
    ).toBe(false);
  });

  it("falls back to base role permissions when custom list is empty", () => {
    expect(canWithCustom("operator", [], "campaigns.manage")).toBe(true);
    expect(canWithCustom("operator", [], "billing.manage")).toBe(false);
  });

  it("falls back to base role permissions when custom list is null/undefined", () => {
    expect(canWithCustom("admin", null, "members.manage")).toBe(true);
    expect(canWithCustom("viewer", undefined, "members.manage")).toBe(false);
  });

  it("always allows owner even with empty custom permissions", () => {
    expect(canWithCustom("owner", [], "billing.manage")).toBe(true);
    expect(canWithCustom("owner", null, "settings.manage")).toBe(true);
    expect(canWithCustom("owner", ["analytics.view"], "billing.manage")).toBe(true);
  });
});

describe("assertCanWithCustom", () => {
  it("throws when custom permissions deny the action", () => {
    expect(() =>
      assertCanWithCustom("viewer", ["analytics.view"], "members.manage"),
    ).toThrow(/Forbidden/);
  });

  it("does not throw when custom permissions grant the action", () => {
    expect(() =>
      assertCanWithCustom("viewer", ["members.manage"], "members.manage"),
    ).not.toThrow();
  });
});

describe("assertWorkspacePermission", () => {
  it("allows owner regardless of customPermissions", () => {
    expect(() =>
      assertWorkspacePermission(
        { role: "owner", customPermissions: [] },
        "billing.manage",
      ),
    ).not.toThrow();
  });

  it("honors customPermissions grant", () => {
    expect(() =>
      assertWorkspacePermission(
        { role: "viewer", customPermissions: ["settings.manage"] },
        "settings.manage",
      ),
    ).not.toThrow();
  });

  it("honors customPermissions deny", () => {
    expect(() =>
      assertWorkspacePermission(
        { role: "viewer", customPermissions: ["analytics.view"] },
        "settings.manage",
      ),
    ).toThrow(/Forbidden/);
  });

  it("falls back to base role when customPermissions absent", () => {
    expect(() =>
      assertWorkspacePermission({ role: "admin" }, "members.manage"),
    ).not.toThrow();
    expect(() =>
      assertWorkspacePermission({ role: "viewer" }, "members.manage"),
    ).toThrow(/Forbidden/);
  });
});
