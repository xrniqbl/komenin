import { isRedirectError } from "next/dist/client/components/redirect-error";
import { NextResponse } from "next/server";
import { inferApiCode } from "@/lib/api-errors";

function redirectDestination(error: { digest: string }): string {
  // digest format: NEXT_REDIRECT;{type};{url};{status};
  return error.digest.split(";").slice(2, -2).join(";");
}

/**
 * Known-safe user-facing error prefixes thrown by server helpers. Only
 * messages starting with these are passed through verbatim — anything else
 * (Prisma internals, env/config errors, stack details) is masked behind the
 * fallback message so internal structure never reaches the client.
 */
const SAFE_ERROR_PREFIXES = [
  "Voucher ",
  "Plan ",
  "Order ",
  "Workspace ",
  "Invalid ",
  "Missing ",
];

function isSafeClientMessage(message: string): boolean {
  return SAFE_ERROR_PREFIXES.some((prefix) => message.startsWith(prefix));
}

/**
 * Map thrown errors from page-oriented server helpers (which may call
 * `redirect()`) into JSON API responses.
 */
export function jsonErrorFromUnknown(
  error: unknown,
  fallbackMessage: string,
  fallbackStatus = 400,
): NextResponse {
  if (isRedirectError(error)) {
    // requireActiveWorkspace redirects unauthenticated callers to /login
    // and users without a workspace to /onboarding.
    const destination = redirectDestination(error);
    const needsWorkspace = destination.includes("/onboarding");
    return NextResponse.json(
      {
        error: needsWorkspace ? "Workspace required" : "Unauthorized",
        code: needsWorkspace ? "WORKSPACE_REQUIRED" : "UNAUTHORIZED",
      },
      { status: needsWorkspace ? 403 : 401 },
    );
  }

  const rawMessage = error instanceof Error ? error.message : "";
  // Full error is always logged server-side; clients only see vetted copy.
  if (rawMessage) {
    console.error("[api-route] handler error:", error);
  }
  const message = rawMessage && isSafeClientMessage(rawMessage) ? rawMessage : fallbackMessage;
  const lower = message.toLowerCase();
  const status =
    lower.includes("unauthorized") || lower.includes("unauthenticated")
      ? 401
      : lower.includes("forbidden") || lower.includes("access denied")
        ? 403
        : lower.includes("not found")
          ? 404
          : fallbackStatus;

  return NextResponse.json({ error: message, code: inferApiCode(message, status) }, { status });
}
