import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/app/page-header";
import { getAiRouterStatus } from "@/lib/ai";

export default function AiGatewaySettingsPage() {
  const status = getAiRouterStatus();

  return (
    <div>
      <PageHeader
        title="AI Gateway"
        description="Aether uses 9Router as the only AI gateway. Provider auth (including xAI build auth) stays inside 9Router."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Status</CardDescription>
            <CardTitle className="text-2xl">
              {status.enabled ? "9Router linked" : "Local fallback"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={status.enabled ? "default" : "secondary"}>
              {status.enabled ? "via 9Router" : "local rule-based"}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Configured tiers</CardDescription>
            <CardTitle className="text-2xl">{status.providerCount}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Aether only talks to 9Router. Model routing/auth is owned by 9Router.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Safety</CardDescription>
            <CardTitle className="text-2xl">Always on</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            If 9Router is down, Aether falls back to local rule-based drafts.
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Expected setup</CardTitle>
          <CardDescription>
            Keep xAI / Claude / OpenAI credentials inside 9Router (build auth). Aether only needs the local OpenAI-compatible endpoint.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <div>
            <code>AI_GATEWAY_BASE_URL=http://localhost:20128/v1</code>
          </div>
          <div>
            <code>AI_GATEWAY_API_KEY=</code> empty unless 9Router itself requires a key
          </div>
          <div>
            <code>AI_MODEL_PRIMARY</code> / <code>AI_MODEL_FALLBACKS</code> must match model IDs exposed by 9Router
          </div>
        </CardContent>
      </Card>

      <div className="mt-6 space-y-3">
        {status.providers.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>9Router not configured</CardTitle>
              <CardDescription>
                Start 9Router locally, then set AI_GATEWAY_BASE_URL=http://localhost:20128/v1 and restart Aether.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          status.providers.map((provider, index) => (
            <Card key={provider.id}>
              <CardHeader>
                <CardTitle className="text-base">
                  Tier {index + 1}: {provider.id}
                </CardTitle>
                <CardDescription>{provider.baseUrl}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2 text-sm">
                <Badge variant="secondary">
                  {provider.hasApiKey ? "gateway key set" : "no gateway key"}
                </Badge>
                {provider.models.map((model) => (
                  <Badge key={model} variant="outline">
                    {model}
                  </Badge>
                ))}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}