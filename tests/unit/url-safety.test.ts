import { afterEach, describe, expect, it } from "vitest";
import {
  assertSafeOutboundUrl,
  isBlockedIpAddress,
  UnsafeUrlError,
} from "@/lib/url-safety";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env.NODE_ENV = originalEnv.NODE_ENV;
  process.env.ALLOW_SECURITY_STUBS = originalEnv.ALLOW_SECURITY_STUBS;
  process.env.SIMULATOR_MODE = originalEnv.SIMULATOR_MODE;
});

describe("url-safety", () => {
  it("blocks private and metadata IPs", () => {
    expect(isBlockedIpAddress("127.0.0.1")).toBe(true);
    expect(isBlockedIpAddress("10.0.0.5")).toBe(true);
    expect(isBlockedIpAddress("192.168.1.1")).toBe(true);
    expect(isBlockedIpAddress("172.16.0.1")).toBe(true);
    expect(isBlockedIpAddress("169.254.169.254")).toBe(true);
    expect(isBlockedIpAddress("::1")).toBe(true);
    expect(isBlockedIpAddress("8.8.8.8")).toBe(false);
  });

  it("allows public HTTPS URLs", () => {
    process.env.NODE_ENV = "production";
    process.env.ALLOW_SECURITY_STUBS = "false";
    process.env.SIMULATOR_MODE = "false";
    const url = assertSafeOutboundUrl("https://hooks.slack.com/services/T/B/X");
    expect(url.protocol).toBe("https:");
  });

  it("rejects localhost and private targets in production", () => {
    process.env.NODE_ENV = "production";
    process.env.ALLOW_SECURITY_STUBS = "true";
    process.env.SIMULATOR_MODE = "true";
    expect(() => assertSafeOutboundUrl("http://127.0.0.1/hook")).toThrow(UnsafeUrlError);
    expect(() => assertSafeOutboundUrl("https://169.254.169.254/latest")).toThrow(UnsafeUrlError);
    expect(() => assertSafeOutboundUrl("https://10.0.0.8/internal")).toThrow(UnsafeUrlError);
    expect(() => assertSafeOutboundUrl("http://example.com/hook")).toThrow(UnsafeUrlError);
  });

  it("allows localhost HTTP only when non-prod stubs enabled", () => {
    process.env.NODE_ENV = "development";
    process.env.ALLOW_SECURITY_STUBS = "true";
    process.env.SIMULATOR_MODE = "true";
    const url = assertSafeOutboundUrl("http://localhost:3000/api/publish/webhook");
    expect(url.hostname).toBe("localhost");
  });

  it("rejects URL credentials", () => {
    process.env.NODE_ENV = "development";
    process.env.ALLOW_SECURITY_STUBS = "true";
    expect(() => assertSafeOutboundUrl("https://user:pass@example.com/x")).toThrow(
      /credentials/i,
    );
  });
});
