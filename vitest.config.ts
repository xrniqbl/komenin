import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const alias = {
  "@": path.resolve(__dirname, "./src"),
};

export default defineConfig({
  plugins: [react()],
  resolve: { alias },
  test: {
    projects: [
      {
        // Component tests need a DOM and testing-library cleanup.
        extends: true,
        test: {
          name: "components",
          environment: "jsdom",
          setupFiles: ["./vitest.setup.ts"],
          include: [
            "tests/components/**/*.{test,spec}.{ts,tsx}",
            "src/**/*.{test,spec}.tsx",
          ],
        },
      },
      {
        // Pure logic/server tests: the much cheaper node environment.
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: [
            "tests/**/*.{test,spec}.{ts,tsx}",
            "src/**/*.{test,spec}.{ts,tsx}",
          ],
          exclude: [
            "**/node_modules/**",
            "tests/components/**",
            "src/**/*.{test,spec}.tsx",
          ],
        },
      },
    ],
  },
});
