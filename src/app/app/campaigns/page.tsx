import { Button } from "@/components/ui/button";
import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { StatusPill } from "@/components/session-routing/status-pill";
import { platformLabel } from "@/lib/session-routing";
import { listCampaigns } from "@/server/campaigns";

export default async function CampaignsPage() {
  const campaigns = await listCampaigns();

  return (
    <div>
      <PageHeader
        title="Campaigns"
        description="Approval-first engagement campaigns across social tunnels."
        action={
          <Button variant="default"  asChild><Link href="/app/campaigns/new">New campaign</Link></Button>
        }
      />

      <div className="overflow-hidden rounded-2xl border border bg-background">
        {campaigns.length === 0 ? (
          <div className="px-4 py-10 text-sm text-muted-foreground">No campaigns yet.</div>
        ) : (
          campaigns.map((campaign) => (
            <div key={campaign.id} className="grid grid-cols-12 gap-2 border-b border px-4 py-3 text-sm last:border-b-0">
              <div className="col-span-4">
                <Link href={`/app/campaigns/${campaign.id}`} className="font-medium hover:text-primary">
                  {campaign.name}
                </Link>
                <div className="text-xs text-muted-foreground">{campaign.goal || "No goal set"}</div>
              </div>
              <div className="col-span-2">{platformLabel(campaign.platform)}</div>
              <div className="col-span-2">
                <StatusPill
                  label={campaign.status}
                  color={campaign.status === "active" ? "var(--signal-ok)" : "var(--ink-500)"}
                />
              </div>
              <div className="col-span-2 text-xs text-muted-foreground">{campaign.mode}</div>
              <div className="col-span-2 text-xs text-muted-foreground">
                {campaign._count.targetPosts} posts · {campaign._count.approvals} approvals
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
