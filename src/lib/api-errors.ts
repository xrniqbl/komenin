import { NextResponse } from "next/server";

/**
 * Canonical API error contract.
 *
 * Every JSON error response from `src/app/api` uses the shape
 * `{ error: <human message>, code: <STABLE_CODE> }` where `code` is a
 * machine-readable constant clients can branch on. `error` is a single
 * default language (English) — localized UI copy lives in the i18n
 * dictionaries, never in API bodies.
 *
 * Rules for adding new errors:
 * - Reuse an existing code when the meaning matches; add a code only for a
 *   genuinely new failure mode.
 * - Keep `error` free of internals (ids, env names, stack fragments).
 * - Zod validation failures surface the first issue message with
 *   INVALID_INPUT so clients still see the field-level reason.
 */
export const API_CODES = {
  INVALID_JSON: "INVALID_JSON",
  INVALID_INPUT: "INVALID_INPUT",
  INVALID_QUERY: "INVALID_QUERY",
  INVALID_FORM: "INVALID_FORM",
  INVALID_JOB: "INVALID_JOB",
  MISSING_CODE: "MISSING_CODE",
  UNAUTHORIZED: "UNAUTHORIZED",
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  INVALID_SIGNATURE: "INVALID_SIGNATURE",
  TOKEN_MISMATCH: "TOKEN_MISMATCH",
  FORBIDDEN: "FORBIDDEN",
  SCOPE_REQUIRED: "SCOPE_REQUIRED",
  INVALID_ORIGIN: "INVALID_ORIGIN",
  WORKSPACE_REQUIRED: "WORKSPACE_REQUIRED",
  FEATURE_DISABLED: "FEATURE_DISABLED",
  NOT_FOUND: "NOT_FOUND",
  NOT_CONFIGURED: "NOT_CONFIGURED",
  RATE_LIMITED: "RATE_LIMITED",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
  EMAIL_UNAVAILABLE: "EMAIL_UNAVAILABLE",
  PAYMENT_REJECTED: "PAYMENT_REJECTED",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type ApiErrorCode = (typeof API_CODES)[keyof typeof API_CODES];

const CANONICAL_MESSAGES: Record<ApiErrorCode, string> = {
  INVALID_JSON: "Invalid JSON body",
  INVALID_INPUT: "Invalid input",
  INVALID_QUERY: "Invalid query",
  INVALID_FORM: "Invalid form data",
  INVALID_JOB: "Invalid job",
  MISSING_CODE: "Authorization code is required",
  UNAUTHORIZED: "Unauthorized",
  INVALID_CREDENTIALS: "Invalid credentials",
  INVALID_SIGNATURE: "Invalid signature",
  TOKEN_MISMATCH: "Verify token mismatch",
  FORBIDDEN: "Forbidden",
  SCOPE_REQUIRED: "Missing required scope",
  INVALID_ORIGIN: "Cross-origin request rejected",
  WORKSPACE_REQUIRED: "Workspace required",
  FEATURE_DISABLED: "Feature disabled",
  NOT_FOUND: "Not found",
  NOT_CONFIGURED: "Service is not configured",
  RATE_LIMITED: "Too many requests. Please try again shortly.",
  SERVICE_UNAVAILABLE: "Service temporarily unavailable",
  EMAIL_UNAVAILABLE: "Failed to send email. Please try again shortly.",
  PAYMENT_REJECTED: "Payment rejected",
  INTERNAL_ERROR: "Internal server error",
};

/**
 * Build a standardized JSON error response. Pass `message` only when the
 * call site has a safe, more specific reason (zod issue, missing scope,
 * allowed-job list) — otherwise the canonical message for the code applies.
 */
export function apiError(
  code: ApiErrorCode,
  status: number,
  message?: string,
  init?: { headers?: HeadersInit },
): NextResponse {
  return NextResponse.json(
    { error: message ?? CANONICAL_MESSAGES[code], code },
    { status, ...init },
  );
}

/** Derive a stable code for legacy/unknown error paths from status + text. */
export function inferApiCode(message: string, status: number): ApiErrorCode {
  const lower = message.toLowerCase();
  if (status === 401) {
    return lower.includes("signature")
      ? API_CODES.INVALID_SIGNATURE
      : lower.includes("secret") || lower.includes("token") || lower.includes("credential")
        ? API_CODES.INVALID_CREDENTIALS
        : API_CODES.UNAUTHORIZED;
  }
  if (status === 403) {
    if (lower.includes("workspace")) return API_CODES.WORKSPACE_REQUIRED;
    if (lower.includes("scope")) return API_CODES.SCOPE_REQUIRED;
    if (lower.includes("cross-origin") || lower.includes("origin"))
      return API_CODES.INVALID_ORIGIN;
    return API_CODES.FORBIDDEN;
  }
  if (status === 404) return API_CODES.NOT_FOUND;
  if (status === 429) return API_CODES.RATE_LIMITED;
  if (status === 501 || status === 503) {
    return lower.includes("email")
      ? API_CODES.EMAIL_UNAVAILABLE
      : lower.includes("configur")
        ? API_CODES.NOT_CONFIGURED
        : API_CODES.SERVICE_UNAVAILABLE;
  }
  if (status >= 500) return API_CODES.INTERNAL_ERROR;
  if (lower.includes("json")) return API_CODES.INVALID_JSON;
  if (lower.includes("scope")) return API_CODES.SCOPE_REQUIRED;
  return API_CODES.INVALID_INPUT;
}
