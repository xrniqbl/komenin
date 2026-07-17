"use server";

import { revalidatePath } from "next/cache";
import { assertCan } from "@/lib/rbac";
import { parseConnectorPolicy } from "@/lib/connectors";
import { db } from "@/lib/db";
import { requireActiveWorkspace } from "@/server/workspace-access";
import { writeAuditLog } from "@/server/audit";
import {
  getPublisherStatus as basePublisherStatus,
  testPublishWebhook as baseTestPublishWebhook,
} from "@/server/publish-deliveries";

export async function getPublisherStatus() {
  const base = await basePublisherStatus();
  const { workspace } = await requireActiveWorkspace();
  return {
    ...base,
    connectorPolicy: workspace.connectorPolicy,
    planCode: workspace.planCode,
    monthlySendLimit: workspace.monthlySendLimit,
    monthlyPublishLimit: workspace.monthlyPublishLimit,
  };
}

export async function updateConnectorPolicy(policy: string) {
  const { userId, workspace } = await requireActiveWorkspace();
  assertCan(workspace.role, "settings.manage");
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
