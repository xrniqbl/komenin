import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

/**
 * Restore `window.localStorage` when the host Node shadows it.
 *
 * Node >= 24 ships an experimental global `localStorage` that only works when
 * `--localstorage-file` is passed. Without the flag the property exists but is
 * `undefined`. Vitest's jsdom environment copies Node globals onto the jsdom
 * window whenever the window lacks them, so jsdom's own Storage implementation
 * gets replaced by `undefined` — and every component touching
 * `window.localStorage` throws `Cannot read properties of undefined`.
 *
 * The shim is deliberately in-memory: component tests get a deterministic
 * per-worker store that does not depend on the host Node version and never
 * leaks across test files.
 */
if (typeof window !== "undefined" && !window.localStorage) {
  const store = new Map<string, string>();
  const storage: Storage = {
    get length(): number {
      return store.size;
    },
    clear(): void {
      store.clear();
    },
    getItem(key: string): string | null {
      const k = String(key);
      return store.has(k) ? (store.get(k) as string) : null;
    },
    key(index: number): string | null {
      return [...store.keys()][index] ?? null;
    },
    removeItem(key: string): void {
      store.delete(String(key));
    },
    setItem(key: string, value: string): void {
      store.set(String(key), String(value));
    },
  };
  Object.defineProperty(window, "localStorage", {
    value: storage,
    configurable: true,
    writable: true,
  });
}

afterEach(() => {
  cleanup();
});