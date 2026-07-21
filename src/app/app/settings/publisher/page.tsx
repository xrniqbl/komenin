import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormSelect } from "@/components/ui/form-select";
import { Label } from "@/components/ui/label";
import {
  getPublisherStatus,
  testPublishWebhook,
  updateConnectorPolicy,
} from "@/server/publisher-settings";

export default async function PublisherSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{
    tested?: string;
    ok?: string;
    message?: string;
    id?: string;
    oauth?: string;
    provider?: string;
    stub?: string;
    error?: string;
  }>;
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

      {params.oauth === "connected" ? (
        <Card className="mb-6 border-emerald-500/40 bg-emerald-500/5">
          <CardHeader>
            <CardTitle className="text-base">
              OAuth credential stored
              {params.provider ? ` (${params.provider})` : ""}
            </CardTitle>
            <CardDescription>
              Access token was encrypted into the workspace connector vault. Official publish can use
              this credential when policy prefers official adapters.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {params.oauth === "error" ||
      params.oauth === "not_implemented" ||
      params.oauth === "not_configured" ||
      params.stub === "1" ? (
        <Card className="mb-6 border-amber-500/40 bg-amber-500/5">
          <CardHeader>
            <CardTitle className="text-base">
              Official OAuth
              {params.provider ? ` (${params.provider})` : ""}
              {params.oauth === "error"
                ? " failed"
                : params.oauth === "not_configured"
                  ? " not configured"
                  : " not available"}
            </CardTitle>
            <CardDescription>
              {params.oauth === "error" && params.error
                ? params.error
                : "Use Instagram authorize when app credentials are configured, session-cookie import under Accounts, or a publish webhook."}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
            <CardTitle className="text-2xl">{status.hasToken ? "Token set" : "Required"}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Bearer token via <code>SOCIAL_PUBLISH_WEBHOOK_TOKEN</code> is required unless{" "}
            <code>ALLOW_SECURITY_STUBS=true</code> in non-production.
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-base">Official OAuth / credential vault</CardTitle>
            <Badge variant={status.instagramOAuthConfigured ? "default" : "secondary"}>
              {status.instagramOAuthConfigured ? "Instagram ready" : "Instagram env missing"}
            </Badge>
          </div>
          <CardDescription>
            Tokens are stored encrypted in <code>ConnectorCredential</code>. Threads/TikTok OAuth
            authorize flows are still not shipped. Session import remains the primary account path.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {status.instagramOAuthConfigured ? (
              <Button render={<a href="/api/connectors/instagram/authorize" />} nativeButton={false}>
                Connect Instagram OAuth
              </Button>
            ) : (
              <Button type="button" disabled variant="outline">
                Connect Instagram OAuth
              </Button>
            )}
            <Button type="button" disabled variant="outline">
              Threads (soon)
            </Button>
            <Button type="button" disabled variant="outline">
              TikTok (soon)
            </Button>
          </div>
          {!status.instagramOAuthConfigured ? (
            <p className="text-xs text-muted-foreground">
              Set <code>INSTAGRAM_APP_ID</code>, <code>INSTAGRAM_APP_SECRET</code>, and{" "}
              <code>APP_URL</code> to enable authorize + token exchange.
            </p>
          ) : null}
          {status.credentials.length === 0 ? (
            <p className="text-sm text-muted-foreground">No vault credentials stored yet.</p>
          ) : (
            <div className="space-y-2">
              {status.credentials.map((cred) => (
                <div
                  key={cred.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
                >
                  <div>
                    <span className="font-medium">{cred.provider}</span>
                    {cred.label ? (
                      <span className="text-muted-foreground"> · {cred.label}</span>
                    ) : null}
                    <div className="text-xs text-muted-foreground">
                      {cred.isActive ? "active" : "inactive"}
                      {cred.hasRefreshToken ? " · refresh token" : ""}
                      {cred.expiresAt
                        ? ` · expires ${new Date(cred.expiresAt).toISOString().slice(0, 10)}`
                        : ""}
                    </div>
                  </div>
                  <Badge variant="outline">{cred.scopes.length ? `${cred.scopes.length} scopes` : "token"}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Connector policy</CardTitle>
          <CardDescription>
            Hybrid routing: simulator / webhook-first / official adapters.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={savePolicy} className="flex flex-col gap-3 md:flex-row md:items-end">
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="policy">Policy</Label>
              <FormSelect
                id="policy"
                name="policy"
                defaultValue={status.connectorPolicy}
                options={[
                  { value: "prefer_webhook", label: "prefer_webhook" },
                  { value: "prefer_official", label: "prefer_official" },
                  { value: "webhook_only", label: "webhook_only" },
                  { value: "official_only", label: "official_only" },
                  { value: "simulator_only", label: "simulator_only" },
                ]}
              />
            </div>
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
          <div><code>SOCIAL_PUBLISH_WEBHOOK_TOKEN=&quot;long-random-token&quot;</code> (required)</div>
          <div><code>SOCIAL_CONNECTOR_POLICY=&quot;prefer_webhook&quot;</code></div>
          <div>Optional official (partial): <code>SOCIAL_OFFICIAL_API_BASE_URL</code> + <code>SOCIAL_OFFICIAL_API_TOKEN</code></div>
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