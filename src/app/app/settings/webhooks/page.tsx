import { PageHeader } from "@/components/app/page-header";
import { WebhooksManager } from "@/components/webhooks/webhooks-manager";
import { listWebhookEndpoints } from "@/server/webhooks";

export default async function WebhooksPage() {
  const endpoints = await listWebhookEndpoints();

  return (
    <div>
      <PageHeader
        title="External Webhooks"
        description="Outbound event notifications to Slack, Discord, or custom URLs (account degraded, approval timeout, etc). This is not the social publish bridge — configure SOCIAL_PUBLISH_WEBHOOK_URL under Publisher / env for Instagram/Threads/TikTok delivery."
      />
      <WebhooksManager initial={endpoints} />
    </div>
  );
}
