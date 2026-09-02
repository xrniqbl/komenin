import { PageHeader } from "@/components/app/page-header";
import { AiProvidersManager } from "@/components/settings/ai-providers-manager";
import { KomeninAiCard } from "@/components/settings/komenin-ai-card";
import { getWorkspaceAiSettings, getWorkspaceAiBillingStatus } from "@/server/ai-providers";
import { listAiCheckoutPlans } from "@/server/billing";

export default async function AiGatewaySettingsPage() {
  const [settings, aiStatus, aiPlans] = await Promise.all([
    getWorkspaceAiSettings(),
    getWorkspaceAiBillingStatus(),
    listAiCheckoutPlans(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI providers"
        description="Configure 9Router, OpenAI, Anthropic, or any OpenAI-compatible gateway for social comment bots. Keys are encrypted per workspace."
      />
      <KomeninAiCard
        status={aiStatus}
        aiPlans={aiPlans.map((p) => ({
          code: p.code,
          name: p.name,
          description: p.description,
          kind: p.kind as "ai_subscription" | "ai_credits",
          priceIdr: p.priceIdr,
          aiCredits: p.aiCredits,
        }))}
      />
      <AiProvidersManager
        initialProviders={settings.providers}
        initialDefaults={settings.defaults}
        envBootstrap={settings.envBootstrap}
      />
    </div>
  );
}
