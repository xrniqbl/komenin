import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assertSafeOutboundUrl,
  isBlockedIpAddress,
  UnsafeUrlError,
} from "@/lib/url-safety";

afterEach(() => {
  vi.unstubAllEnvs();
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
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ALLOW_SECURITY_STUBS", "false");
    vi.stubEnv("SIMULATOR_MODE", "false");
    const url = assertSafeOutboundUrl("https://hooks.slack.com/services/T/B/X");
    expect(url.protocol).toBe("https:");
  });

  it("rejects localhost and private targets in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ALLOW_SECURITY_STUBS", "true");
    vi.stubEnv("SIMULATOR_MODE", "true");
    expect(() => assertSafeOutboundUrl("http://127.0.0.1/hook")).toThrow(UnsafeUrlError);
    expect(() => assertSafeOutboundUrl("https://169.254.169.254/latest")).toThrow(UnsafeUrlError);
    expect(() => assertSafeOutboundUrl("https://10.0.0.8/internal")).toThrow(UnsafeUrlError);
    expect(() => assertSafeOutboundUrl("http://example.com/hook")).toThrow(UnsafeUrlError);
  });

  it("allows localhost HTTP only when non-prod stubs enabled", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ALLOW_SECURITY_STUBS", "true");
    vi.stubEnv("SIMULATOR_MODE", "true");
    const url = assertSafeOutboundUrl("http://localhost:3000/api/publish/webhook");
    expect(url.hostname).toBe("localhost");
  });

  it("rejects URL credentials", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ALLOW_SECURITY_STUBS", "true");
    expect(() => assertSafeOutboundUrl("https://user:pass@example.com/x")).toThrow(
      /credentials/i,
    );
  });
});
