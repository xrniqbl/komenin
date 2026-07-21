import { db } from "@/lib/db";

/**
 * SSO policy helpers.
 *
 * Important: `workspace.ssoRequired` is stored for a future enforcement path.
 * Do NOT hard-block Google login until SAML ACS creates real Auth.js sessions.
 * These helpers support progressive rollout and honest product checks.
 */

export type SsoDomainPolicy = {
  workspaceId: string;
  emailDomain: string;
  ssoRequired: boolean;
  ssoActive: boolean;
  entryPoint: string;
  protocol: string;
};

export async function findSsoPolicyForEmail(email: string): Promise<SsoDomainPolicy | null> {
  const domain = email.split("@")[1]?.trim().toLowerCase();
  if (!domain) return null;

  const config = await db.ssoConfig.findFirst({
    where: {
      isActive: true,
      emailDomain: domain,
    },
    include: {
      workspace: { select: { id: true, ssoRequired: true, status: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!config || config.workspace.status !== "active") return null;

  return {
    workspaceId: config.workspaceId,
    emailDomain: domain,
    ssoRequired: config.workspace.ssoRequired,
    ssoActive: config.isActive,
    entryPoint: config.entryPoint,
    protocol: config.protocol,
  };
}

/**
 * Returns whether SSO *should* be required for this email once ACS is production-ready.
 * Currently advisory — callers must not treat this as an auth gate unless ACS is complete.
 */
export async function isSsoRequiredForEmail(email: string): Promise<boolean> {
  const policy = await findSsoPolicyForEmail(email);
  return Boolean(policy?.ssoRequired && policy.ssoActive);
}

/** Feature flag: real SAML ACS session bridge is not shipped yet. */
export function isSsoLoginEnforced(): boolean {
  return process.env.SSO_ENFORCE_LOGIN === "true";
}
