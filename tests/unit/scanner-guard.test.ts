import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  EDGE_API_THROTTLE,
  buildSecurityTxt,
  consumeEdgeThrottle,
  isScannerProbe,
  isThrottledApiPath,
  logScannerProbe,
  resetEdgeThrottleForTests,
  resolveSecurityContact,
} from "@/lib/scanner-guard";

describe("scanner-guard", () => {
  beforeEach(() => {
    resetEdgeThrottleForTests();
    vi.unstubAllEnvs();
  });

  it("flags classic leaked-file and console probes", () => {
    expect(isScannerProbe("/.env")).toBe(true);
    expect(isScannerProbe("/.git/config")).toBe(true);
    expect(isScannerProbe("/wp-admin/")).toBe(true);
    expect(isScannerProbe("/phpmyadmin/index.php")).toBe(true);
    expect(isScannerProbe("/actuator/health")).toBe(true);
    expect(isScannerProbe("/config.php")).toBe(true);
  });

  it("flags injection payloads in the query string", () => {
    expect(isScannerProbe("/api/contact", "?q=1%20union%20select%201")).toBe(true);
    expect(isScannerProbe("/pricing", "?x=../../../../etc/passwd")).toBe(true);
    expect(isScannerProbe("/", "?q=%3Cscript%3Ealert(1)")).toBe(true);
  });

  it("lets legitimate traffic through", () => {
    expect(isScannerProbe("/")).toBe(false);
    expect(isScannerProbe("/pricing")).toBe(false);
    expect(isScannerProbe("/docs/api/worker")).toBe(false);
    expect(isScannerProbe("/api/contact", "?name=budi")).toBe(false);
    expect(isScannerProbe("/app/settings/security")).toBe(false);
    expect(isScannerProbe("/security.txt")).toBe(false);
    expect(isScannerProbe("/.well-known/security.txt")).toBe(false);
  });

  it("matching is case-insensitive", () => {
    expect(isScannerProbe("/.ENV")).toBe(true);
    expect(isScannerProbe("/WP-ADMIN")).toBe(true);
  });

  it("edge throttle allows under the limit then denies", () => {
    const ip = `198.51.100.9:${Date.now()}`;
    for (let i = 0; i < EDGE_API_THROTTLE.limit; i += 1) {
      expect(consumeEdgeThrottle(ip).allowed).toBe(true);
    }
    const verdict = consumeEdgeThrottle(ip);
    expect(verdict.allowed).toBe(false);
    if (!verdict.allowed) {
      expect(verdict.resetAt).toBeGreaterThan(Date.now());
    }
  });

  it("throttles API routes but skips worker, cron, and health", () => {
    expect(isThrottledApiPath("/api/contact")).toBe(true);
    expect(isThrottledApiPath("/api/v1/campaigns")).toBe(true);
    expect(isThrottledApiPath("/pricing")).toBe(false);
    expect(isThrottledApiPath("/api/worker/cron")).toBe(false);
    expect(isThrottledApiPath("/api/health")).toBe(false);
  });

  it("logs probes as one greppable warn line", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    logScannerProbe({ pathname: "/.env", ip: "203.0.113.1", userAgent: "masscan" });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain("[scanner-probe]");
    expect(warn.mock.calls[0][0]).toContain("/.env");
    warn.mockRestore();
  });

  it("resolves security contact with env fallback chain", () => {
    vi.stubEnv("SECURITY_CONTACT", "mailto:security@example.com");
    expect(resolveSecurityContact()).toBe("mailto:security@example.com");

    vi.stubEnv("SECURITY_CONTACT", "");
    vi.stubEnv("SUPPORT_INBOX_EMAIL", "cs@example.com");
    expect(resolveSecurityContact()).toBe("mailto:cs@example.com");

    vi.stubEnv("SUPPORT_INBOX_EMAIL", "");
    expect(resolveSecurityContact()).toBe("mailto:cs@komenin.id");
  });

  it("builds a minimal RFC 9116 body", () => {
    vi.stubEnv("SECURITY_CONTACT", "mailto:security@example.com");
    const body = buildSecurityTxt();
    expect(body).toContain("Contact: mailto:security@example.com");
    expect(body).toContain("Preferred-Languages:");
    expect(body.endsWith("\n")).toBe(true);
  });
});
