import { timingSafeEqual } from "node:crypto";

export function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production";
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
  return process.env.ALLOW_SECURITY_STUBS === "true" || process.env.SIMULATOR_MODE !== "false";
}