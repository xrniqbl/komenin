import Link from "next/link";
import { FilterBar } from "@/components/app/filter-bar";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { StatusPill } from "@/components/session-routing/status-pill";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { platformLabel } from "@/lib/session-routing";
import { listCampaigns } from "@/server/campaigns";

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "completed", label: "Completed" },
];

const PLATFORM_OPTIONS = [
  { value: "instagram", label: "Instagram" },
  { value: "threads", label: "Threads" },
  { value: "tiktok", label: "TikTok" },
];

export default async function CampaignsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; platform?: string }>;
}) {
  const params = await searchParams;
  const campaigns = await listCampaigns({
    q: params.q,
    status: params.status,
    platform: params.platform,
  });

  return (
    <div>
      <PageHeader
        title="Campaigns"
        description="Approval-first engagement campaigns across social tunnels."
        action={
          <Button variant="default" render={<Link href="/app/campaigns/new" />} nativeButton={false}>
            New campaign
          </Button>
        }
      />

      <div className="mb-4">
        <FilterBar
          placeholder="Search campaigns..."
          statusOptions={STATUS_OPTIONS}
          platformOptions={PLATFORM_OPTIONS}
          defaultQ={params.q || ""}
          defaultStatus={params.status || ""}
          defaultPlatform={params.platform || ""}
        />
      </div>

      <Card className="gap-0 overflow-hidden py-0">
        {campaigns.length === 0 ? (
          <Empty className="py-12"><EmptyHeader><EmptyTitle>No campaigns yet</EmptyTitle><EmptyDescription>Create your first campaign to start discovery and approvals.</EmptyDescription></EmptyHeader></Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Platform</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead>Volume</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map((campaign) => (
                <TableRow key={campaign.id}>
                  <TableCell>
                    <Link href={`/app/campaigns/${campaign.id}`} className="font-medium hover:text-primary">
                      {campaign.name}
                    </Link>
                    <div className="text-xs text-muted-foreground">{campaign.goal || "No goal set"}</div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {campaign.client?.name || "—"}
                  </TableCell>
                  <TableCell>{platformLabel(campaign.platform)}</TableCell>
                  <TableCell>
                    <StatusPill
                      label={campaign.status}
                      color={campaign.status === "active" ? "var(--signal-ok)" : "var(--ink-500)"}
                    />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{campaign.mode}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {campaign._count.targetPosts} posts · {campaign._count.approvals} approvals
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
