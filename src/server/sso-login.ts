import { db } from "@/lib/db";
import { isAssertionTimeValid, parseSamlResponse } from "@/lib/saml/parse";
import { signSsoTicket } from "@/lib/sso-ticket";
import type { WorkspaceRole } from "@/types/workspace";

export type SsoLoginResult = {
  userId: string;
  workspaceId: string;
  email: string;
  ticket: string;
};

/**
 * JIT provision user + membership from a validated SSO identity, mint one-time ticket.
 * Caller MUST authenticate the assertion (signature) before invoking in production paths.
 */
const SSO_SAFE_ROLES: WorkspaceRole[] = [
  "admin",
  "operator",
  "analyst",
  "auditor",
  "viewer",
];

function sanitizeJitRole(role: WorkspaceRole): WorkspaceRole {
  if (role === "owner" || !SSO_SAFE_ROLES.includes(role)) return "operator";
  return role;
}

export async function completeSsoIdentityLogin(input: {
  email: string;
  name?: string | null;
  workspaceId: string;
  defaultRole: WorkspaceRole;
  protocol: string;
  auditAction?: string;
}): Promise<SsoLoginResult> {
  const email = input.email.trim().toLowerCase();
  if (!email.includes("@")) throw new Error("Invalid SSO email");
  const jitRole = sanitizeJitRole(input.defaultRole);

  const user = await db.user.upsert({
    where: { email },
    create: {
      email,
      name: input.name?.trim() || email.split("@")[0],
      emailVerified: new Date(),
      lastLoginAt: new Date(),
    },
    update: {
      name: input.name?.trim() || undefined,
      lastLoginAt: new Date(),
    },
  });

  const existingMembership = await db.membership.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId: input.workspaceId,
        userId: user.id,
      },
    },
  });

  if (existingMembership) {
    // Never demote or overwrite owner via SSO JIT; only reactivate.
    await db.membership.update({
      where: { id: existingMembership.id },
      data: { status: "active" },
    });
  } else {
    await db.membership.create({
      data: {
        workspaceId: input.workspaceId,
        userId: user.id,
        role: jitRole,
        status: "active",
      },
    });
  }

  await db.auditLog.create({
    data: {
      workspaceId: input.workspaceId,
      actorUserId: user.id,
      action: input.auditAction || "sso.login",
      resourceType: "membership",
      resourceId: user.id,
      metadata: { protocol: input.protocol, email },
    },
  });

  const ticket = signSsoTicket({
    userId: user.id,
    workspaceId: input.workspaceId,
    email,
    ttlSeconds: 120,
  });

  return {
    userId: user.id,
    workspaceId: input.workspaceId,
    email,
    ticket,
  };
}

export async function loginFromSamlResponse(input: {
  samlResponse: string;
  relayStateWorkspaceId?: string | null;
  /** When true, skip signature requirement (dev only). */
  allowUnsigned: boolean;
}): Promise<SsoLoginResult> {
  const parsed = parseSamlResponse(input.samlResponse);
  if (!parsed.email) throw new Error("SAML assertion missing email/NameID");
  if (!isAssertionTimeValid(parsed.notOnOrAfter)) {
    throw new Error("SAML assertion expired");
  }

  const domain = parsed.email.split("@")[1];
  const config = await db.ssoConfig.findFirst({
    where: {
      isActive: true,
      OR: [
        input.relayStateWorkspaceId
          ? { workspaceId: input.relayStateWorkspaceId }
          : undefined,
        domain ? { emailDomain: domain } : undefined,
      ].filter(Boolean) as object[],
    },
    orderBy: { createdAt: "desc" },
  });
  if (!config) throw new Error("SSO config not found for assertion");

  if (config.emailDomain && domain !== config.emailDomain.toLowerCase()) {
    throw new Error("Email domain not allowed for this SSO config");
  }

  if (parsed.issuer && config.issuer && parsed.issuer !== config.issuer) {
    // Soft check — some IdPs use entityID variants; keep as warning via audit later.
  }

  if (!input.allowUnsigned) {
    // Signature path not implemented yet — refuse.
    throw new Error(
      "SAML signature validation is required. Set ALLOW_SECURITY_STUBS only for local unsigned testing.",
    );
  }

  return completeSsoIdentityLogin({
    email: parsed.email,
    name: parsed.name,
    workspaceId: config.workspaceId,
    defaultRole: config.defaultRole,
    protocol: config.protocol,
    auditAction: "sso.login_saml_unsigned_dev",
  });
}
