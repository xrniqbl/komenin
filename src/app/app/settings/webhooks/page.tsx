import { PageHeader } from "@/components/app/page-header";
import { WebhooksManager } from "@/components/webhooks/webhooks-manager";
import { listWebhookEndpoints } from "@/server/webhooks";

export default async function WebhooksPage() {
  const endpoints = await listWebhookEndpoints();

  return (
    <div>
      <PageHeader
        title="External Webhooks"
        description="Send real-time notifications to Slack, Discord, or any webhook URL when key events happen (account degraded, approval timeout, etc)."
      />
      <WebhooksManager initial={endpoints} />
    </div>
  );
}
