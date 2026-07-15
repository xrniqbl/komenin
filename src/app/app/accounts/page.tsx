import { Button } from "@/components/ui/button";
import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { StatusPill } from "@/components/session-routing/status-pill";
import { SignalRailRow } from "@/components/session-routing/signal-rail-row";
import { platformLabel, statusTone } from "@/lib/session-routing";
import { listAccounts } from "@/server/accounts";
import { rotateAccountIp, runAccountHealthCheck } from "@/server/accounts";

export default async function AccountsPage() {
  const accounts = await listAccounts();

  return (
    <div>
      <PageHeader
        title="Accounts"
        description="Multi-tunnel grid for Instagram, Threads, and TikTok identities."
        action={
          <Button variant="default"  asChild><Link href="/app/accounts/new">Connect account</Link></Button>
        }
      />

      <div className="overflow-hidden rounded-2xl border border bg-background">
        <div className="grid grid-cols-12 gap-2 border-b border bg-muted/30 px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <div className="col-span-3">Account</div>
          <div className="col-span-2">Platform</div>
          <div className="col-span-2">IP / Proxy</div>
          <div className="col-span-2">Health</div>
          <div className="col-span-1">Quota</div>
          <div className="col-span-2">Actions</div>
        </div>

        {accounts.length === 0 ? (
          <div className="px-4 py-10 text-sm text-muted-foreground">
            No accounts yet. Connect your first social tunnel to populate the grid.
          </div>
        ) : (
          accounts.map((account) => {
            const proxy = account.proxyAssignments[0]?.proxyEndpoint;
            const color = statusTone(account.status);
            return (
              <SignalRailRow key={account.id} color={color}>
                <div className="grid grid-cols-12 items-center gap-2 px-4 py-3 text-sm">
                  <div className="col-span-3">
                    <Link href={`/app/accounts/${account.id}`} className="font-medium hover:text-primary">
                      @{account.username}
                    </Link>
                    <div className="text-xs text-muted-foreground">{account.displayName || "—"}</div>
                  </div>
                  <div className="col-span-2">{platformLabel(account.platform)}</div>
                  <div className="col-span-2">
                    <div className="font-mono text-xs">{account.currentIp || "—"}</div>
                    <div className="text-xs text-muted-foreground">{proxy?.label || "No proxy"}</div>
                  </div>
                  <div className="col-span-2">
                    <StatusPill label={account.status} color={color} />
                    <div className="mt-1 text-xs text-muted-foreground">score {account.healthScore}</div>
                  </div>
                  <div className="col-span-1 text-xs text-muted-foreground">
                    {account.actionsToday}/{account.dailyQuota}
                  </div>
                  <div className="col-span-2 flex flex-wrap gap-2">
                    <form
                      action={async () => {
                        "use server";
                        await runAccountHealthCheck(account.id);
                      }}
                    >
                      <Button variant="outline"  type="submit">
                        Probe
                      </Button>
                    </form>
                    <form
                      action={async () => {
                        "use server";
                        await rotateAccountIp(account.id);
                      }}
                    >
                      <Button variant="outline"  type="submit">
                        Rotate IP
                      </Button>
                    </form>
                  </div>
                </div>
              </SignalRailRow>
            );
          })
        )}
      </div>
    </div>
  );
}
