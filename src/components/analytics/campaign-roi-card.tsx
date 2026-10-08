import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type CampaignRoiRow = {
  campaignId: string;
  name: string;
  platform: string;
  status: string;
  clientName: string | null;
  drafts: number;
  approvalsDecided: number;
  approved: number;
  approvalRate: number | null;
  sends: number;
  failedSends: number;
  leadsAttributed: number;
  leadsWon: number;
  sendsPerDay: number;
};

function formatRate(value: number | null): string {
  if (value == null) return "—";
  return `${value}%`;
}

/**
 * Per-campaign ROI: drafts → approvals → sends plus attributed leads
 * (via EngagementLead.campaignId) and delivery pace.
 */
export function CampaignRoiCard({
  title,
  description,
  totals,
  rows,
  labels,
}: {
  title: string;
  description: string;
  totals: { campaigns: number; sends: number; leadsAttributed: number; leadsWon: number };
  rows: CampaignRoiRow[];
  labels: {
    campaign: string;
    drafts: string;
    approved: string;
    approvalRate: string;
    sent: string;
    leads: string;
    perDay: string;
    noData: string;
  };
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <Badge variant="secondary">
            {totals.campaigns} · {totals.sends} sent · {totals.leadsAttributed} leads
            {totals.leadsWon > 0 ? ` (${totals.leadsWon} won)` : ""}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="text-sm">
        {rows.length === 0 ? (
          <div className="text-muted-foreground">{labels.noData}</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{labels.campaign}</TableHead>
                <TableHead className="text-right">{labels.drafts}</TableHead>
                <TableHead className="text-right">{labels.approved}</TableHead>
                <TableHead className="text-right">{labels.approvalRate}</TableHead>
                <TableHead className="text-right">{labels.sent}</TableHead>
                <TableHead className="text-right">{labels.leads}</TableHead>
                <TableHead className="text-right">{labels.perDay}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.slice(0, 20).map((row) => (
                <TableRow key={row.campaignId}>
                  <TableCell>
                    <div className="font-medium">{row.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {row.platform} · {row.status}
                      {row.clientName ? ` · ${row.clientName}` : ""}
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{row.drafts}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.approved}/{row.approvalsDecided}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatRate(row.approvalRate)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.sends}
                    {row.failedSends > 0 ? (
                      <span className="text-destructive"> (+{row.failedSends} failed)</span>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.leadsAttributed}
                    {row.leadsWon > 0 ? ` (${row.leadsWon} won)` : ""}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{row.sendsPerDay}/d</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
