import { PageHeader } from "@/components/app/page-header";
import { LeadsClient } from "@/components/leads/leads-client";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FEATURE_FLAG_KEYS, isFeatureEnabled } from "@/lib/feature-flags";
import { listClients } from "@/server/clients";
import { listLeads } from "@/server/leads";

export default async function LeadsPage() {
  if (!(await isFeatureEnabled(FEATURE_FLAG_KEYS.leadCapture))) {
    return (
      <div>
        <PageHeader title="Leads" description="Lead capture is disabled by feature flag." />
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Module off</CardTitle>
            <CardDescription>
              Enable <code>lead_capture</code> in Admin → Feature flags.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const [leads, clients] = await Promise.all([listLeads(), listClients()]);

  return (
    <div>
      <PageHeader
        title="Leads"
        description="Turn social engagement into a simple pipeline — capture from inbox or approvals, then track status."
      />
      <LeadsClient
        initialLeads={leads.map((lead) => ({
          ...lead,
          createdAt: lead.createdAt.toISOString(),
          updatedAt: lead.updatedAt.toISOString(),
        }))}
        clients={clients.map((c) => ({ id: c.id, name: c.name }))}
      />
    </div>
  );
}
