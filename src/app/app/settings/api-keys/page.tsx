import { PageHeader } from "@/components/app/page-header";
import { ApiKeysManager } from "@/components/settings/api-keys-manager";
import { listApiKeys } from "@/server/api-keys";

export default async function ApiKeysPage() {
  const keys = await listApiKeys();

  return (
    <div>
      <PageHeader
        title="API Keys"
        description="Create keys for /api/v1/* public REST API. Keys are shown once after creation. Store safely."
      />
      <ApiKeysManager initial={keys} />
    </div>
  );
}
