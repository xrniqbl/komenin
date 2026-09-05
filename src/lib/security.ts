import { createHash, timingSafeEqual } from "node:crypto";

export function isProductionRuntime(): boolean {
  // Treat any deployed (non-development) environment as production for the
  // purpose of disabling insecure stubs. Vercel preview/staging builds run with
  // NODE_ENV=production but VERCEL_ENV="preview"; both must be locked down.
  if (process.env.NODE_ENV === "production") return true;
  const vercelEnv = process.env.VERCEL_ENV;
  if (vercelEnv && vercelEnv !== "development") return true;
  return false;
}

export function safeEqual(a: string, b: string): boolean {
  // Hash first so timingSafeEqual always sees equal-length buffers — the
  // previous length early-return leaked whether lengths matched.
  const left = createHash("sha256").update(a).digest();
  const right = createHash("sha256").update(b).digest();
  return timingSafeEqual(left, right);
}

export function requireConfiguredSecret(
  value: string | undefined | null,
  name: string,
): string {
  const secret = value?.trim() || "";
  if (!secret) {
    throw new Error(`${name} is required`);
  }
  return secret;
}

export function allowDevStubs(): boolean {
  // Only a genuine local dev process may enable insecure stubs. A bare
  // ALLOW_SECURITY_STUBS=true on a deployed box (NODE_ENV=production, Vercel
  // preview, `next start`, or NODE_ENV unset) must never open the SAML email
  // stub, unsigned SAML, or SSRF localhost egress.
  if (process.env.NODE_ENV !== "development") return false;
  // Require an explicit opt-in. Previously any SIMULATOR_MODE !== "false" (the
  // default is "true") silently enabled insecure stubs (SSRF/localhost egress,
  // SAML email stub) on every non-production environment.
  return process.env.ALLOW_SECURITY_STUBS === "true";
}