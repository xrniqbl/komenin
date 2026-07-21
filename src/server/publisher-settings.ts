"use server";

import { revalidatePath } from "next/cache";
import { assertWorkspacePermission } from "@/lib/rbac";
import { parseConnectorPolicy } from "@/lib/connectors";
import { isInstagramOAuthConfigured } from "@/lib/oauth-state";
import { db } from "@/lib/db";
import { listConnectorCredentials } from "@/server/connector-credentials";
import { requireActiveWorkspace } from "@/server/workspace-access";
import { writeAuditLog } from "@/server/audit";
import {
  getPublisherStatus as basePublisherStatus,
  testPublishWebhook as baseTestPublishWebhook,
} from "@/server/publish-deliveries";

export async function getPublisherStatus() {
  const base = await basePublisherStatus();
  const { workspace } = await requireActiveWorkspace();
  const credentials = await listConnectorCredentials();
  return {
    ...base,
    connectorPolicy: workspace.connectorPolicy,
    planCode: workspace.planCode,
    monthlySendLimit: workspace.monthlySendLimit,
    monthlyPublishLimit: workspace.monthlyPublishLimit,
    instagramOAuthConfigured: isInstagramOAuthConfigured(),
    credentials,
  };
}

export async function updateConnectorPolicy(policy: string) {
  const { userId, workspace } = await requireActiveWorkspace();
  assertWorkspacePermission(workspace, "settings.manage");
  const next = parseConnectorPolicy(policy);
  await db.workspace.update({
    where: { id: workspace.id },
    data: { connectorPolicy: next },
  });
  await writeAuditLog({
    workspaceId: workspace.id,
    actorUserId: userId,
    action: "connector.policy_updated",
    resourceType: "workspace",
    resourceId: workspace.id,
    metadata: { policy: next },
  });
  revalidatePath("/app/settings/publisher");
  return { ok: true, policy: next };
}

export async function testPublishWebhook() {
  return baseTestPublishWebhook();
}
