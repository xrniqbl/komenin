"use server";

import { listPublishDeliveries } from "@/lib/publish-delivery-log";
import {
  listPublishDeliveriesFromDb,
} from "@/lib/publish-delivery-store";
import { publishSocialPost } from "@/lib/publish-connector";
import { getRuntimeModeLabel } from "@/lib/runtime-mode";
import { assertWorkspacePermission } from "@/lib/rbac";
import { requireActiveWorkspace } from "@/server/workspace-access";
import { writeAuditLog } from "@/server/audit";

export async function getPublisherStatus() {
  const { workspace } = await requireActiveWorkspace();
  const mode = getRuntimeModeLabel();
  const webhookUrl =
    process.env.SOCIAL_PUBLISH_WEBHOOK_URL?.trim() ||
    "http://localhost:3000/api/publish/webhook";
  const hasToken = Boolean(process.env.SOCIAL_PUBLISH_WEBHOOK_TOKEN?.trim());

  // Database rows are the source of truth; the legacy JSONL file is merged
  // in for deliveries recorded before the DB-backed store shipped.
  const [dbRows, fileRows] = await Promise.all([
    listPublishDeliveriesFromDb(30, workspace.id),
    listPublishDeliveries(30, workspace.id).catch(() => []),
  ]);
  const seen = new Set(dbRows.map((row) => row.id));
  const deliveries = [...dbRows, ...fileRows.filter((row) => !seen.has(row.id))]
    .slice(0, 30);

  return {
    mode,
    webhookUrl,
    hasToken,
    localReceiver: "/api/publish/webhook",
    deliveries,
  };
}

export async function testPublishWebhook() {
  const { userId, workspace } = await requireActiveWorkspace();
  assertWorkspacePermission(workspace, "settings.manage");
  const mode = getRuntimeModeLabel();

  // Always exercise the configured live webhook path so the local receiver
  // can be verified even when app default mode is simulator.
  const result = await publishSocialPost({
    forceMode: "live",
    target: {
      platform: "instagram",
      username: "komenin.test",
      accountId: "test-account",
      workspaceId: workspace.id,
    },
    payload: {
      title: "Komenin webhook test",
      body: "This is a test publish payload from Komenin settings.",
      hashtags: ["komenin", "webhook", "test"],
      scheduledFor: new Date(),
    },
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    actorUserId: userId,
    action: "publisher.webhook_tested",
    resourceType: "publisher",
    resourceId: "webhook",
    metadata: {
      ok: result.ok,
      mode,
      connector: result.connector,
      message: result.message,
      externalPostId: result.externalPostId || null,
    },
  });

  return {
    ok: result.ok,
    mode,
    connector: result.connector,
    message: result.message,
    externalPostId: result.externalPostId || null,
  };
}