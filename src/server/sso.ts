"use server";

import { revalidatePath } from "next/cache";
import { assertWorkspacePermission } from "@/lib/rbac";
import { assertSafeOutboundUrl, UnsafeUrlError } from "@/lib/url-safety";
import { db } from "@/lib/db";
import { requireActiveWorkspace } from "@/server/workspace-access";
import { writeAuditLog } from "@/server/audit";

function normalizeEntryPoint(raw: string): string {
  try {
    // Reuse outbound URL policy so SSO entry points cannot target private/metadata hosts.
    return assertSafeOutboundUrl(raw).toString();
  } catch (error) {
    if (error instanceof UnsafeUrlError) throw new Error(`IdP entry point: ${error.message}`);
    throw new Error("Invalid IdP entry point URL");
  }
}

export async function getWorkspaceSsoConfig() {
  const { workspace } = await requireActiveWorkspace();
  return db.ssoConfig.findFirst({
    where: { workspaceId: workspace.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      protocol: true,
      issuer: true,
      entryPoint: true,
      certificate: true,
      emailDomain: true,
      defaultRole: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
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
  assertWorkspacePermission(workspace, "settings.manage");

  const protocol = input.protocol || "saml";
  if (protocol !== "saml" && protocol !== "oidc") {
    throw new Error("Unsupported SSO protocol");
  }
  // OIDC has no production routes yet — store as saml-compatible preview only.
  const issuer = input.issuer.trim();
  const entryPoint = normalizeEntryPoint(input.entryPoint);
  const certificate = input.certificate.trim();
  if (!issuer) throw new Error("Issuer required");
  if (!certificate) throw new Error("Certificate required");
  if (certificate.length > 32_000) throw new Error("Certificate too large");

  const existing = await db.ssoConfig.findFirst({
    where: { workspaceId: workspace.id },
    orderBy: { createdAt: "desc" },
  });

  const config = existing
    ? await db.ssoConfig.update({
        where: { id: existing.id },
        data: {
          protocol,
          issuer,
          entryPoint,
          certificate,
          emailDomain: input.emailDomain?.trim().toLowerCase() || null,
          defaultRole: input.defaultRole || "operator",
          isActive: input.isActive ?? false,
        },
      })
    : await db.ssoConfig.create({
        data: {
          workspaceId: workspace.id,
          protocol,
          issuer,
          entryPoint,
          certificate,
          emailDomain: input.emailDomain?.trim().toLowerCase() || null,
          defaultRole: input.defaultRole || "operator",
          isActive: input.isActive ?? false,
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

