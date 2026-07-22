import { isRedirectError } from "next/dist/client/components/redirect-error";
import { NextResponse } from "next/server";

function redirectDestination(error: { digest: string }): string {
  // digest format: NEXT_REDIRECT;{type};{url};{status};
  return error.digest.split(";").slice(2, -2).join(";");
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

  const message = error instanceof Error ? error.message : fallbackMessage;
  const lower = message.toLowerCase();
  const status =
    lower.includes("unauthorized") || lower.includes("unauthenticated")
      ? 401
      : lower.includes("forbidden") || lower.includes("access denied")
        ? 403
        : lower.includes("not found")
          ? 404
          : fallbackStatus;

  return NextResponse.json({ error: message }, { status });
}
