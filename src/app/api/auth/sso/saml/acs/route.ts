import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { allowDevStubs, isProductionRuntime } from "@/lib/security";
import {
  completeSsoIdentityLogin,
  loginFromSamlResponse,
} from "@/server/sso-login";

export const runtime = "nodejs";

/**
 * SAML ACS endpoint.
 *
 * Production: refuses until XML signature validation is implemented.
 * Dev (ALLOW_SECURITY_STUBS=true): accepts SAMLResponse parse or email form stub,
 * mints a short-lived SSO ticket, redirects to Auth.js session complete.
 */
export async function POST(request: Request) {
  if (isProductionRuntime()) {
    return NextResponse.json(
      {
        error:
          "SAML ACS signature validation is not implemented for production. Do not enable SSO login yet.",
      },
      { status: 501 },
    );
  }

  if (!allowDevStubs()) {
    return NextResponse.json(
      {
        error:
          "SAML ACS is disabled. Set ALLOW_SECURITY_STUBS=true for local unsigned testing only.",
      },
      { status: 501 },
    );
  }

  try {
    const form = await request.formData().catch(() => null);
    const samlResponse = form ? String(form.get("SAMLResponse") || "") : "";
    const relayState = form
      ? String(form.get("RelayState") || form.get("workspaceId") || "")
      : "";

    let result;
    if (samlResponse) {
      result = await loginFromSamlResponse({
        samlResponse,
        relayStateWorkspaceId: relayState || null,
        allowUnsigned: true,
      });
    } else {
      // Legacy dev form: email + optional name/workspace
      const body = form
        ? {
            email: String(form.get("email") || ""),
            name: String(form.get("name") || ""),
            workspaceId: relayState,
          }
        : ((await request.json().catch(() => ({}))) as {
            email?: string;
            name?: string;
            workspaceId?: string;
          });

      const email = (body.email || "").trim().toLowerCase();
      if (!email) {
        return NextResponse.json({ error: "email or SAMLResponse required" }, { status: 400 });
      }
      const domain = email.split("@")[1];
      const config = await db.ssoConfig.findFirst({
        where: {
          isActive: true,
          OR: [
            body.workspaceId ? { workspaceId: body.workspaceId } : undefined,
            domain ? { emailDomain: domain } : undefined,
          ].filter(Boolean) as object[],
        },
      });
      if (!config) {
        return NextResponse.json({ error: "SSO config not found" }, { status: 404 });
      }

      result = await completeSsoIdentityLogin({
        email,
        name: body.name,
        workspaceId: config.workspaceId,
        defaultRole: config.defaultRole,
        protocol: config.protocol,
        auditAction: "sso.login_jit_stub",
      });
    }

    const completeUrl = new URL("/api/auth/sso/complete", request.url);
    completeUrl.searchParams.set("ticket", result.ticket);
    return NextResponse.redirect(completeUrl);
  } catch (error) {
    // Dev-only route, but never reflect internal errors (DB/config details)
    // to the client — log full, return generic.
    console.error("[saml-acs] dev ACS failed", error);
    return NextResponse.json({ error: "ACS failed" }, { status: 400 });
  }
}
