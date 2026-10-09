import { describe, expect, it } from "vitest";
import { escapeCsvValue } from "@/lib/csv";

describe("lead csv escape", () => {
  it("leaves plain values alone", () => {
    expect(escapeCsvValue("hello")).toBe("hello");
    expect(escapeCsvValue(42)).toBe("42");
    expect(escapeCsvValue(null)).toBe("");
  });

  it("quotes commas, quotes, and newlines", () => {
    expect(escapeCsvValue("a,b")).toBe('"a,b"');
    expect(escapeCsvValue('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsvValue("line1\nline2")).toBe('"line1\nline2"');
  });

  it("neutralizes formula-injection prefixes", () => {
    expect(escapeCsvValue("=HYPERLINK(\"http://evil\")")).toBe(
      "\"'=HYPERLINK(\"\"http://evil\"\")\"",
    );
    expect(escapeCsvValue("+1+2")).toBe("'+1+2");
    expect(escapeCsvValue("-2+3")).toBe("'-2+3");
    expect(escapeCsvValue("@mention")).toBe("'@mention");
  });
});
