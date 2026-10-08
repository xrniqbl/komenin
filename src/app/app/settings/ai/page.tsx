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
    <div className="relative space-y-6">
      {/* Ambient glows for glass refraction */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-20 left-1/4 h-64 w-96 rounded-full bg-electric-500/10 blur-[100px]" />
        <div className="absolute top-40 right-1/4 h-48 w-72 rounded-full bg-purple-500/8 blur-[100px]" />
      </div>
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
