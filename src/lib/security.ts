import { timingSafeEqual } from "node:crypto";

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
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
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
  if (isProductionRuntime()) return false;
  // Require an explicit opt-in. Previously any SIMULATOR_MODE !== "false" (the
  // default is "true") silently enabled insecure stubs (SSRF/localhost egress,
  // SAML email stub) on every non-production environment.
  return process.env.ALLOW_SECURITY_STUBS === "true";
}