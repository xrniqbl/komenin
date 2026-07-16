import { NextResponse } from "next/server";
import { getSsoLoginTarget } from "@/server/sso";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email") || "";
  const config = await getSsoLoginTarget(email);
  if (!config) {
    return NextResponse.json(
      { error: "No active SSO config for this email domain" },
      { status: 404 },
    );
  }

  // Lightweight SAML redirect bootstrap (IdP entrypoint). Full XML AuthnRequest can replace this.
  const url = new URL(config.entryPoint);
  url.searchParams.set("RelayState", config.workspaceId);
  url.searchParams.set("email", email);
  return NextResponse.redirect(url.toString());
}
