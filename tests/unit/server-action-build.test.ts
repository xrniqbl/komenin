import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function exportedValues(source: string): string[] {
  return [...source.matchAll(/^export\s+(?:const|let|var|function)\s+(\w+)/gm)].map((match) => match[1]);
}

describe("server action module contract", () => {
  it.each(["src/server/triage.ts", "src/server/listeners.ts"])(
    "%s exports no synchronous values",
    (path) => {
      const source = readFileSync(join(root, path), "utf8");
      expect(source).toMatch(/^"use server";/);
      expect(exportedValues(source)).toEqual([]);
    },
  );
});
