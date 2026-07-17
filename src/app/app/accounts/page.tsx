import Link from "next/link";
import { AccountRowActions } from "@/components/accounts/account-row-actions";
import { FilterBar } from "@/components/app/filter-bar";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusPill } from "@/components/session-routing/status-pill";
import { platformLabel, statusTone } from "@/lib/session-routing";
import { listAccounts } from "@/server/accounts";

const STATUS_OPTIONS = [
  { value: "healthy", label: "Healthy" },
  { value: "degraded", label: "Degraded" },
  { value: "limited", label: "Limited" },
  { value: "banned", label: "Banned" },
  { value: "draft", label: "Draft" },
  { value: "connecting", label: "Connecting" },
];

const PLATFORM_OPTIONS = [
  { value: "instagram", label: "Instagram" },
  { value: "threads", label: "Threads" },
  { value: "tiktok", label: "TikTok" },
];

export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; platform?: string }>;
}) {
  const params = await searchParams;
  const accounts = await listAccounts({
    q: params.q,
    status: params.status,
    platform: params.platform,
  });

  return (
    <div>
      <PageHeader
        title="Accounts"
        description="Multi-tunnel grid for Instagram, Threads, and TikTok identities."
        action={
          <Button variant="default" render={<Link href="/app/accounts/new" />} nativeButton={false}>
            Connect account
          </Button>
        }
      />

      <div className="mb-4">
        <FilterBar
          placeholder="Search accounts..."
          statusOptions={STATUS_OPTIONS}
          platformOptions={PLATFORM_OPTIONS}
          defaultQ={params.q || ""}
          defaultStatus={params.status || ""}
          defaultPlatform={params.platform || ""}
        />
      </div>

      <Card className="gap-0 overflow-hidden py-0">
        {accounts.length === 0 ? (
          <Empty className="py-12">
            <EmptyHeader>
              <EmptyTitle>No accounts found</EmptyTitle>
              <EmptyDescription>
                {params.q || params.status || params.platform
                  ? "Try clearing filters."
                  : "Connect your first social tunnel."}
              </EmptyDescription>
            </EmptyHeader>
            {!params.q && !params.status && !params.platform ? (
              <EmptyContent>
                <Button render={<Link href="/app/accounts/new" />} nativeButton={false}>
                  Connect account
                </Button>
              </EmptyContent>
            ) : null}
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead>Platform</TableHead>
                <TableHead>IP / Proxy</TableHead>
                <TableHead>Health</TableHead>
                <TableHead>Quota</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((account) => {
                const proxy = account.proxyAssignments[0]?.proxyEndpoint;
                const color = statusTone(account.status);
                return (
                  <TableRow key={account.id} className="relative">
                    <TableCell className="relative">
                      <span
                        aria-hidden
                        className="absolute inset-y-2 left-0 w-0.5 rounded-full"
                        style={{ background: color }}
                      />
                      <Link
                        href={`/app/accounts/${account.id}`}
                        className="font-medium hover:text-primary"
                      >
                        @{account.username}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {account.displayName || "—"}
                      </div>
                    </TableCell>
                    <TableCell>{platformLabel(account.platform)}</TableCell>
                    <TableCell>
                      <div className="font-mono text-xs">{account.currentIp || "—"}</div>
                      <div className="text-xs text-muted-foreground">
                        {proxy?.label || "No proxy"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusPill label={account.status} color={color} />
                      <div className="mt-1 text-xs text-muted-foreground">
                        score {account.healthScore}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {account.actionsToday}/{account.dailyQuota}
                    </TableCell>
                    <TableCell className="text-right">
                      <AccountRowActions accountId={account.id} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
