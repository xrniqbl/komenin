import { NextResponse } from "next/server";
import { assertSafeOutboundUrl, UnsafeUrlError } from "@/lib/url-safety";
import { apiError } from "@/lib/api-errors";
import { getSsoLoginTarget } from "@/server/sso-service";
import { consumeRateLimit, getRequestRateKey } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function GET(request: Request) {
  // Per-IP rate limit (auth-adjacent endpoint, fail-closed): prevents
  // enumeration/probing of SSO-enabled domains.
  const ipRate = await consumeRateLimit({
    key: getRequestRateKey(request, "auth:sso:login:ip"),
    limit: 20,
    windowMs: 60_000,
    failClosed: true,
  });
  if (!ipRate.ok) {
    return apiError("RATE_LIMITED", 429);
  }

  const { searchParams } = new URL(request.url);
  const email = (searchParams.get("email") || "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return apiError("INVALID_INPUT", 400, "Valid email required");
  }

  const config = await getSsoLoginTarget(email);
  if (!config) {
    return apiError("NOT_FOUND", 404, "No active SSO config for this email domain");
  }

  // Validate stored entryPoint again at redirect time (defense in depth / legacy rows).
  let url: URL;
  try {
    url = assertSafeOutboundUrl(config.entryPoint);
  } catch (error) {
    // Never reflect stored admin config (IdP URL / validation detail) to an
    // unauthenticated caller — log full, return generic.
    console.error("[sso-login] entry point validation failed", error);
    return apiError(
      "INVALID_INPUT",
      400,
      error instanceof UnsafeUrlError
        ? "Configured IdP entry point is not allowed"
        : "Configured IdP entry point is invalid",
    );
  }

  // Lightweight SAML redirect bootstrap only — not a complete AuthnRequest.
  // Full SSO login is not production-ready (see ACS 501).
  url.searchParams.set("RelayState", config.workspaceId);
  // Do not forward arbitrary email query pollution; pass only the resolved address.
  url.searchParams.set("email", email);
  return NextResponse.redirect(url.toString());
}
