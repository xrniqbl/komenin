import { describe, expect, it } from "vitest";
import { parseVariables, renderTemplate, countVariableUsages } from "@/lib/template-engine";

describe("template-engine", () => {
  it("parses variables from body", () => {
    const vars = parseVariables("Hi {{authorHandle}}, insight {{postSnippet}} — {{goal}}");
    expect(vars).toContain("authorHandle");
    expect(vars).toContain("postSnippet");
    expect(vars).toContain("goal");
    expect(vars.length).toBe(3);
  });

  it("renders template with context", () => {
    const body = "Halo {{authorHandle}} di {{platform}}, {{postSnippet}}";
    const result = renderTemplate(body, {
      authorHandle: "techfounder",
      platform: "instagram",
      postSnippet: "AI infra scaling",
    });
    expect(result).toContain("techfounder");
    expect(result).toContain("instagram");
    expect(result).toContain("AI infra");
  });

  it("renders missing var as empty", () => {
    const result = renderTemplate("Hi {{missing}} there", {});
    expect(result).toBe("Hi  there");
  });

  it("counts variable usages", () => {
    const count = countVariableUsages("{{authorHandle}} {{authorHandle}} {{platform}}", "authorHandle");
    expect(count).toBe(2);
  });

  it("empty body parses no vars", () => {
    expect(parseVariables("")).toEqual([]);
  });
});
