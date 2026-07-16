"use server";

import { listPublishDeliveries } from "@/lib/publish-delivery-log";
import { publishSocialPost } from "@/lib/publish-connector";
import { getRuntimeModeLabel } from "@/lib/runtime-mode";
import { requireActiveWorkspace } from "@/server/active-workspace";
import { writeAuditLog } from "@/server/audit";

export async function getPublisherStatus() {
  await requireActiveWorkspace();
  const mode = getRuntimeModeLabel();
  const webhookUrl =
    process.env.SOCIAL_PUBLISH_WEBHOOK_URL?.trim() ||
    "http://localhost:3000/api/publish/webhook";
  const hasToken = Boolean(process.env.SOCIAL_PUBLISH_WEBHOOK_TOKEN?.trim());
  const deliveries = await listPublishDeliveries(30);

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
  const mode = getRuntimeModeLabel();

  // Always exercise the configured live webhook path so the local receiver
  // can be verified even when app default mode is simulator.
  const result = await publishSocialPost({
    forceMode: "live",
    target: {
      platform: "instagram",
      username: "aether.test",
      accountId: "test-account",
    },
    payload: {
      title: "Aether webhook test",
      body: "This is a test publish payload from Aether settings.",
      hashtags: ["aether", "webhook", "test"],
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