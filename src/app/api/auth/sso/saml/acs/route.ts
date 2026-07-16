import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

/**
 * SAML ACS stub:
 * Accepts assertion payload metadata and JIT-provisions membership when email domain matches.
 * Replace with full XML signature validation in production IdP integration.
 */
export async function POST(request: Request) {
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
        action: "sso.login_jit",
        resourceType: "membership",
        resourceId: user.id,
        metadata: { protocol: config.protocol, email },
      },
    });

    // Client should complete session via normal auth; ACS acknowledges provisioning.
    return NextResponse.json({
      ok: true,
      userId: user.id,
      workspaceId: config.workspaceId,
      next: "/login?sso=1",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "ACS failed" },
      { status: 400 },
    );
  }
}
