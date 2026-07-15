import { describe, expect, it } from "vitest";
import { platformLabel, simulateIp, statusTone } from "@/lib/session-routing";

describe("session-routing helpers", () => {
  it("labels platforms", () => {
    expect(platformLabel("instagram")).toBe("Instagram");
    expect(platformLabel("threads")).toBe("Threads");
    expect(platformLabel("tiktok")).toBe("TikTok");
  });

  it("returns status colors", () => {
    expect(statusTone("healthy")).toContain("signal-ok");
    expect(statusTone("banned")).toContain("signal-danger");
  });

  it("simulates deterministic-looking ips", () => {
    const ip = simulateIp("account-1");
    expect(ip).toMatch(/^\d+\.\d+\.\d+\.\d+$/);
  });
});
