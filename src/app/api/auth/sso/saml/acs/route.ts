import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { allowDevStubs, isProductionRuntime } from "@/lib/security";

export const runtime = "nodejs";

/**
 * SAML ACS endpoint.
 * Full XML signature validation is required for production IdP integration.
 * The development stub is disabled unless ALLOW_SECURITY_STUBS=true and not production.
 */
export async function POST(request: Request) {
  if (isProductionRuntime() || !allowDevStubs()) {
    return NextResponse.json(
      {
        error:
          "SAML ACS stub is disabled. Configure full IdP assertion signature validation before enabling SSO login.",
      },
      { status: 501 },
    );
  }

  try {
    const form = await request.formData().catch(() => null);
    const body = form
      ? {
          email: String(form.get("email") || ""),
          name: String(form.get("name") || ""),
          workspaceId: String(form.get("RelayState") || form.get("workspaceId") || ""),
        }
      : ((await request.json().catch(() => ({}))) as {
          email?: string;
          name?: string;
          workspaceId?: string;
        });

    const email = (body.email || "").trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ error: "email required" }, { status: 400 });
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

    const user = await db.user.upsert({
      where: { email },
      create: {
        email,
        name: body.name || email.split("@")[0],
        emailVerified: new Date(),
      },
      update: {
        name: body.name || undefined,
        lastLoginAt: new Date(),
      },
    });

    await db.membership.upsert({
      where: {
        workspaceId_userId: {
          workspaceId: config.workspaceId,
          userId: user.id,
        },
      },
      create: {
        workspaceId: config.workspaceId,
        userId: user.id,
        role: config.defaultRole,
        status: "active",
      },
      update: {
        status: "active",
      },
    });

    await db.auditLog.create({
      data: {
        workspaceId: config.workspaceId,
        actorUserId: user.id,
        action: "sso.login_jit_stub",
        resourceType: "membership",
        resourceId: user.id,
        metadata: { protocol: config.protocol, email, stub: true },
      },
    });

    return NextResponse.json({
      ok: true,
      userId: user.id,
      workspaceId: config.workspaceId,
      next: "/login?sso=1",
      warning: "Development SSO stub only. Not safe for production.",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "ACS failed" },
      { status: 400 },
    );
  }
}