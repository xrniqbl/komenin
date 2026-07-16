"use server";

import { revalidatePath } from "next/cache";
import { assertCan } from "@/lib/rbac";
import { db } from "@/lib/db";
import { requireActiveWorkspace } from "@/server/active-workspace";
import { writeAuditLog } from "@/server/audit";

export async function getWorkspaceSsoConfig() {
  const { workspace } = await requireActiveWorkspace();
  return db.ssoConfig.findFirst({
    where: { workspaceId: workspace.id },
    orderBy: { createdAt: "desc" },
  });
}

export async function saveWorkspaceSsoConfig(input: {
  protocol?: "saml" | "oidc";
  issuer: string;
  entryPoint: string;
  certificate: string;
  emailDomain?: string;
  defaultRole?: "owner" | "admin" | "operator" | "analyst" | "auditor" | "viewer";
  isActive?: boolean;
  ssoRequired?: boolean;
}) {
  const { userId, workspace } = await requireActiveWorkspace();
  assertCan(workspace.role, "settings.manage");

  const existing = await db.ssoConfig.findFirst({
    where: { workspaceId: workspace.id },
    orderBy: { createdAt: "desc" },
  });

  const config = existing
    ? await db.ssoConfig.update({
        where: { id: existing.id },
        data: {
          protocol: input.protocol || "saml",
          issuer: input.issuer.trim(),
          entryPoint: input.entryPoint.trim(),
          certificate: input.certificate.trim(),
          emailDomain: input.emailDomain?.trim() || null,
          defaultRole: input.defaultRole || "operator",
          isActive: input.isActive ?? true,
        },
      })
    : await db.ssoConfig.create({
        data: {
          workspaceId: workspace.id,
          protocol: input.protocol || "saml",
          issuer: input.issuer.trim(),
          entryPoint: input.entryPoint.trim(),
          certificate: input.certificate.trim(),
          emailDomain: input.emailDomain?.trim() || null,
          defaultRole: input.defaultRole || "operator",
          isActive: input.isActive ?? true,
        },
      });

  await db.workspace.update({
    where: { id: workspace.id },
    data: { ssoRequired: Boolean(input.ssoRequired) },
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    actorUserId: userId,
    action: "sso.config_saved",
    resourceType: "sso_config",
    resourceId: config.id,
  });

  revalidatePath("/app/settings/security");
  return config;
}

export async function getSsoLoginTarget(email: string) {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return null;
  return db.ssoConfig.findFirst({
    where: {
      isActive: true,
      emailDomain: domain,
    },
    include: { workspace: true },
  });
}
