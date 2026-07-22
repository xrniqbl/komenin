import { PageHeader } from "@/components/app/page-header";
import { AiProvidersManager } from "@/components/settings/ai-providers-manager";
import { getWorkspaceAiSettings } from "@/server/ai-providers";

export default async function AiGatewaySettingsPage() {
  const settings = await getWorkspaceAiSettings();

  return (
    <div>
      <PageHeader
        title="AI providers"
        description="Configure 9Router, OpenAI, Anthropic, or any OpenAI-compatible gateway for social comment bots. Keys are encrypted per workspace."
      />
      <AiProvidersManager
        initialProviders={settings.providers}
        initialDefaults={settings.defaults}
        envBootstrap={settings.envBootstrap}
      />
    </div>
  );
}
