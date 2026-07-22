import { describe, expect, it } from "vitest";
import { looksLikeDemoCookieValue } from "@/lib/session-payload";

// probeEncryptedSession needs decrypt + network; unit-test pure helpers and shape gates here.
describe("session health prerequisites", () => {
  it("rejects demo cookie values used in fake sessions", () => {
    expect(looksLikeDemoCookieValue("demo_session")).toBe(true);
    expect(looksLikeDemoCookieValue("real_session_token_abc")).toBe(false);
  });
});
