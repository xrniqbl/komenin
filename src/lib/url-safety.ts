import { isIP } from "node:net";
import { lookup } from "node:dns/promises";
import { allowDevStubs, isProductionRuntime } from "@/lib/security";

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeUrlError";
  }
}

function normalizeHostname(hostname: string): string {
  return hostname.trim().toLowerCase().replace(/\.$/, "").replace(/^\[|\]$/g, "");
}

function isLocalhostName(hostname: string): boolean {
  const host = normalizeHostname(hostname);
  return (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host === "0:0:0:0:0:0:0:1"
  );
}

function isMetadataHostname(hostname: string): boolean {
  const host = normalizeHostname(hostname);
  return (
    host === "metadata" ||
    host === "metadata.google.internal" ||
    host === "metadata.goog" ||
    host.endsWith(".metadata.google.internal")
  );
}

/** True for private, loopback, link-local, CGNAT, and other non-public targets. */
export function isBlockedIpAddress(ip: string): boolean {
  const value = normalizeHostname(ip);
  const version = isIP(value);
  if (version === 4) {
    const parts = value.split(".").map((part) => Number(part));
    if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
      return true;
    }
    const [a, b] = parts;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
    if (a >= 224) return true; // multicast / reserved
    return false;
  }

  if (version === 6) {
    if (value === "::" || value === "::1") return true;
    const lowered = value.toLowerCase();
    if (lowered.startsWith("fc") || lowered.startsWith("fd")) return true; // ULA
    if (lowered.startsWith("fe8") || lowered.startsWith("fe9") || lowered.startsWith("fea") || lowered.startsWith("feb")) {
      return true; // link-local fe80::/10
    }
    // IPv4-mapped IPv6 ::ffff:a.b.c.d
    const mapped = lowered.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
    if (mapped) return isBlockedIpAddress(mapped[1]);
    // Unique local / site local deprecated fec0::/10
    if (lowered.startsWith("fec") || lowered.startsWith("fed") || lowered.startsWith("fee") || lowered.startsWith("fef")) {
      return true;
    }
    return false;
  }

  return false;
}

export function isBlockedHostname(hostname: string): boolean {
  const host = normalizeHostname(hostname);
  if (!host) return true;
  if (isMetadataHostname(host)) return true;
  if (host.endsWith(".local") || host.endsWith(".internal") || host.endsWith(".intranet")) return true;
  if (isIP(host)) return isBlockedIpAddress(host);
  return false;
}

/**
 * Sync URL policy for user-controlled outbound targets (webhooks, skills).
 * - Production: HTTPS only, no localhost/private/metadata
 * - Dev stubs: HTTP allowed only for localhost; still block cloud metadata / non-local private IPs
 */
export function assertSafeOutboundUrl(raw: string): URL {
  const trimmed = raw?.trim() || "";
  if (!trimmed) throw new UnsafeUrlError("URL required");

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new UnsafeUrlError("Invalid URL");
  }

  if (url.username || url.password) {
    throw new UnsafeUrlError("URL credentials are not allowed");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UnsafeUrlError("URL must be http(s)");
  }

  const host = normalizeHostname(url.hostname);
  if (!host) throw new UnsafeUrlError("URL hostname required");

  const local = isLocalhostName(host);
  const stubs = allowDevStubs();

  if (url.protocol === "http:") {
    if (isProductionRuntime() || !stubs || !local) {
      throw new UnsafeUrlError(
        isProductionRuntime()
          ? "Only HTTPS URLs are allowed"
          : "HTTP is only allowed for localhost when security stubs are enabled",
      );
    }
  }

  if (local) {
    if (isProductionRuntime() || !stubs) {
      throw new UnsafeUrlError("Localhost URLs are not allowed");
    }
    return url;
  }

  if (isBlockedHostname(host)) {
    throw new UnsafeUrlError("URL target is not allowed");
  }

  return url;
}

/** Resolve DNS and reject hosts that point at private/metadata addresses. */
export async function assertSafeOutboundUrlResolved(raw: string): Promise<URL> {
  const url = assertSafeOutboundUrl(raw);
  const host = normalizeHostname(url.hostname);

  if (isLocalhostName(host) || isIP(host)) {
    return url;
  }

  try {
    // DNS can hang on a black-hole resolver — bound it so callers never wait
    // longer than the fetch timeout for name resolution alone.
    const records = await Promise.race([
      lookup(host, { all: true, verbatim: true }),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new UnsafeUrlError("URL hostname resolution timed out")),
          8000,
        ),
      ),
    ]);
    if (!records.length) {
      throw new UnsafeUrlError("Unable to resolve URL hostname");
    }
    for (const record of records) {
      if (isBlockedIpAddress(record.address)) {
        throw new UnsafeUrlError("URL resolves to a private or blocked address");
      }
    }
  } catch (error) {
    if (error instanceof UnsafeUrlError) throw error;
    throw new UnsafeUrlError("Unable to resolve URL hostname");
  }

  return url;
}

/** Default ceiling for outbound connector fetches (matches AI/email callers). */
export const OUTBOUND_FETCH_TIMEOUT_MS = 15_000;

/** fetch() wrapper that validates target and refuses redirects (redirect SSRF). */
export async function safeOutboundFetch(
  rawUrl: string,
  init?: RequestInit,
): Promise<Response> {
  const url = await assertSafeOutboundUrlResolved(rawUrl);
  const callerSignal = init?.signal;
  const timeoutSignal = AbortSignal.timeout(OUTBOUND_FETCH_TIMEOUT_MS);
  const signal = callerSignal
    ? AbortSignal.any([callerSignal, timeoutSignal])
    : timeoutSignal;
  return fetch(url.toString(), {
    ...init,
    signal,
    redirect: "error",
  });
}
