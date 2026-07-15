import { describe, expect, it } from "vitest";
import { slugifyWorkspaceName } from "@/lib/workspace";

describe("slugifyWorkspaceName", () => {
  it("slugifies basic names", () => {
    expect(slugifyWorkspaceName("Acme Growth")).toBe("acme-growth");
  });

  it("strips invalid characters", () => {
    expect(slugifyWorkspaceName("Hello!!! Team")).toBe("hello-team");
  });
});
