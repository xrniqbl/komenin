/**
 * Sanitize post-login redirect targets.
 *
 * The login page accepts ?callbackUrl= and hands it to Auth.js sign-in. A
 * naive startsWith("/") check misses percent-encoded backslashes (%5c),
 * control characters, and /\/ tricks that can smuggle an off-site target.
 * Only same-origin absolute paths survive; everything else falls back.
 */

const FALLBACK = "/onboarding";

export function sanitizeCallbackUrl(
  raw: string | null | undefined,
  fallback = FALLBACK,
): string {
  if (!raw || typeof raw !== "string") return fallback;
  let value = raw.trim();
  if (!value) return fallback;

  // Decode once so %5c / %2f smuggling is visible before validation.
  try {
    const decoded = decodeURIComponent(value);
    // A double-encoded payload (%255c) decodes to a still-encoded string;
    // reject it rather than passing an ambiguous value downstream.
    if (/%[0-9a-fA-F]{2}/.test(decoded)) return fallback;
    value = decoded;
  } catch {
    return fallback;
  }

  // Reject control characters, backslashes, protocol-relative and
  // scheme-carrying values. Only a single-leading-slash path is allowed.
  if (/[\u0000-\u001f\u007f\\]/.test(value)) return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value)) return fallback;

  return value;
}
