import { PageHeader } from "@/components/app/page-header";
import { ClientsClient } from "@/components/clients/clients-client";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FEATURE_FLAG_KEYS, isFeatureEnabled } from "@/lib/feature-flags";
import { listClients } from "@/server/clients";
import { requireActiveWorkspace } from "@/server/workspace-access";
import { db } from "@/lib/db";

export default async function ClientsPage() {
  if (!(await isFeatureEnabled(FEATURE_FLAG_KEYS.agencyClients))) {
    return (
      <div>
        <PageHeader title="Clients" description="Agency clients are disabled by feature flag." />
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Module off</CardTitle>
            <CardDescription>
              Enable <code>agency_clients</code> in Admin → Feature flags.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const { workspace } = await requireActiveWorkspace();
  const [clients, ws] = await Promise.all([
    listClients(),
    db.workspace.findUnique({
      where: { id: workspace.id },
      select: { agencyLabel: true, name: true },
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Clients"
        description="Lightweight multi-client tags for agencies — assign leads and campaigns without separate workspaces."
      />
      <ClientsClient
        agencyLabel={ws?.agencyLabel || ""}
        workspaceName={ws?.name || workspace.name}
        clients={clients.map((c) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          notes: c.notes,
          isActive: c.isActive,
          leads: c._count.leads,
          campaigns: c._count.campaigns,
        }))}
      />
    </div>
  );
}
