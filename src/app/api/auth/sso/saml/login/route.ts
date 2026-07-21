import { NextResponse } from "next/server";
import { assertSafeOutboundUrl, UnsafeUrlError } from "@/lib/url-safety";
import { getSsoLoginTarget } from "@/server/sso-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = (searchParams.get("email") || "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  const config = await getSsoLoginTarget(email);
  if (!config) {
    return NextResponse.json(
      { error: "No active SSO config for this email domain" },
      { status: 404 },
    );
  }

  // Validate stored entryPoint again at redirect time (defense in depth / legacy rows).
  let url: URL;
  try {
    url = assertSafeOutboundUrl(config.entryPoint);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof UnsafeUrlError
            ? `Configured IdP entry point is not allowed: ${error.message}`
            : "Configured IdP entry point is invalid",
      },
      { status: 400 },
    );
  }

  // Lightweight SAML redirect bootstrap only — not a complete AuthnRequest.
  // Full SSO login is not production-ready (see ACS 501).
  url.searchParams.set("RelayState", config.workspaceId);
  // Do not forward arbitrary email query pollution; pass only the resolved address.
  url.searchParams.set("email", email);
  return NextResponse.redirect(url.toString());
}
