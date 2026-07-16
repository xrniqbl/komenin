import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getPublisherStatus,
  testPublishWebhook,
  updateConnectorPolicy,
} from "@/server/publisher-settings";

export default async function PublisherSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tested?: string; ok?: string; message?: string; id?: string }>;
}) {
  const params = await searchParams;
  const status = await getPublisherStatus();

  async function runTest() {
    "use server";
    const result = await testPublishWebhook();
    revalidatePath("/app/settings/publisher");
    const qs = new URLSearchParams({
      tested: "1",
      ok: result.ok ? "1" : "0",
      message: result.message,
      id: result.externalPostId || "",
    });
    redirect(`/app/settings/publisher?${qs.toString()}`);
  }

  async function savePolicy(formData: FormData) {
    "use server";
    await updateConnectorPolicy(String(formData.get("policy") || "prefer_webhook"));
  }

  return (
    <div>
      <PageHeader
        title="Publisher"
        description="Hybrid connector policy, webhook receiver, and delivery history."
        action={
          <form action={runTest}>
            <Button type="submit">Test webhook</Button>
          </form>
        }
      />

      {params.tested === "1" ? (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">
              {params.ok === "1" ? "Webhook test succeeded" : "Webhook test failed"}
            </CardTitle>
            <CardDescription>
              {params.message || "No message"}
              {params.id ? ` · id=${params.id}` : ""}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>Mode</CardDescription>
            <CardTitle className="text-2xl">{status.mode}</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={status.mode === "simulator" ? "secondary" : "default"}>
              {status.mode === "simulator" ? "simulator publisher" : "live publisher"}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Policy</CardDescription>
            <CardTitle className="text-base">{status.connectorPolicy}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Plan {status.planCode}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Webhook target</CardDescription>
            <CardTitle className="text-base break-all">{status.webhookUrl}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Local receiver: {status.localReceiver}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Webhook auth</CardDescription>
            <CardTitle className="text-2xl">{status.hasToken ? "Token set" : "Open"}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Optional bearer via SOCIAL_PUBLISH_WEBHOOK_TOKEN.
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Connector policy</CardTitle>
          <CardDescription>
            Hybrid routing: simulator / webhook-first / official adapters.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={savePolicy} className="flex flex-col gap-3 md:flex-row md:items-end">
            <label className="text-sm flex-1">
              Policy
              <select
                name="policy"
                defaultValue={status.connectorPolicy}
                className="mt-1 w-full rounded-lg border px-3 py-2"
              >
                <option value="prefer_webhook">prefer_webhook</option>
                <option value="prefer_official">prefer_official</option>
                <option value="webhook_only">webhook_only</option>
                <option value="official_only">official_only</option>
                <option value="simulator_only">simulator_only</option>
              </select>
            </label>
            <Button type="submit">Save policy</Button>
          </form>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">How to go live</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <div><code>SIMULATOR_MODE=&quot;false&quot;</code></div>
          <div><code>SOCIAL_PUBLISH_WEBHOOK_URL=&quot;https://your-worker/hooks/aether&quot;</code></div>
          <div><code>SOCIAL_CONNECTOR_POLICY=&quot;prefer_webhook&quot;</code></div>
          <div>Optional official: <code>SOCIAL_OFFICIAL_API_BASE_URL</code> + <code>SOCIAL_OFFICIAL_API_TOKEN</code></div>
        </CardContent>
      </Card>

      <div className="mt-6 space-y-3">
        <h2 className="text-sm font-semibold tracking-tight">Recent deliveries</h2>
        {status.deliveries.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">No deliveries yet</CardTitle>
              <CardDescription>Use Test webhook or publish due content posts in live mode.</CardDescription>
            </CardHeader>
          </Card>
        ) : (
          status.deliveries.map((delivery) => (
            <Card key={delivery.id}>
              <CardHeader>
                <CardTitle className="text-base">
                  {delivery.platform} · @{delivery.username || "unassigned"}
                </CardTitle>
                <CardDescription>
                  {delivery.receivedAt.replace("T", " ").slice(0, 19)} UTC · {delivery.externalPostId}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {delivery.title ? <div className="font-medium">{delivery.title}</div> : null}
                <div className="whitespace-pre-wrap text-muted-foreground">{delivery.body}</div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
