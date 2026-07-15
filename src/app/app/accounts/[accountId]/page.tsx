import { Button } from "@/components/ui/button";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/app/page-header";
import { StatusPill } from "@/components/session-routing/status-pill";
import { platformLabel, statusTone } from "@/lib/session-routing";
import { getAccount, rotateAccountIp, runAccountHealthCheck } from "@/server/accounts";

export default async function AccountDetailPage({
  params,
}: {
  params: Promise<{ accountId: string }>;
}) {
  const { accountId } = await params;
  const account = await getAccount(accountId);
  if (!account) notFound();

  const proxy = account.proxyAssignments[0]?.proxyEndpoint;
  const activeSession = account.sessions[0];

  return (
    <div>
      <PageHeader
        title={`@${account.username}`}
        description={`${platformLabel(account.platform)} tunnel detail`}
        action={
          <Link href="/app/accounts" className="text-sm text-primary">
            Back to grid
          </Link>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border bg-background p-5 md:col-span-2">
          <div className="flex flex-wrap items-center gap-3">
            <StatusPill label={account.status} color={statusTone(account.status)} />
            <span className="text-sm text-muted-foreground">Health score {account.healthScore}</span>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Current IP</div>
              <div className="mt-1 font-mono text-sm">{account.currentIp || "—"}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Proxy</div>
              <div className="mt-1 text-sm">{proxy ? `${proxy.label} (${proxy.protocol})` : "Unassigned"}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Daily quota</div>
              <div className="mt-1 text-sm">
                {account.actionsToday}/{account.dailyQuota}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Active session</div>
              <div className="mt-1 text-sm">{activeSession ? activeSession.id.slice(0, 10) + "…" : "None"}</div>
            </div>
          </div>

          <div className="mt-6 flex gap-2">
            <form
              action={async () => {
                "use server";
                await runAccountHealthCheck(account.id);
              }}
            >
              <Button variant="outline"  type="submit">
                Run health probe
              </Button>
            </form>
            <form
              action={async () => {
                "use server";
                await rotateAccountIp(account.id, "detail_manual_rotate");
              }}
            >
              <Button variant="default"  type="submit">
                Rotate IP
              </Button>
            </form>
          </div>
        </div>

        <div className="rounded-2xl border border bg-background p-5">
          <div className="font-medium">Session vault</div>
          <p className="mt-2 text-sm text-muted-foreground">
            Cookies/tokens are stored encrypted at rest. Raw secrets are never rendered in the UI.
          </p>
          {activeSession ? (
            <div className="mt-4 space-y-2 text-sm">
              <div>UA: <span className="text-muted-foreground">{activeSession.userAgent.slice(0, 48)}…</span></div>
              <div>Key version: {activeSession.keyVersion}</div>
              <div>Active: {activeSession.isActive ? "yes" : "no"}</div>
            </div>
          ) : (
            <div className="mt-4 text-sm text-muted-foreground">No active session.</div>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border bg-background p-5">
          <div className="font-medium">Recent health checks</div>
          <div className="mt-3 space-y-2">
            {account.healthChecks.length === 0 ? (
              <div className="text-sm text-muted-foreground">No probes yet.</div>
            ) : (
              account.healthChecks.map((check) => (
                <div key={check.id} className="rounded-lg border border px-3 py-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span>{check.ok ? "OK" : "Fail"} · {check.signal}</span>
                    <span className="text-xs text-muted-foreground">{check.latencyMs ?? "—"} ms</span>
                  </div>
                  <div className="text-xs text-muted-foreground">{check.details}</div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border bg-background p-5">
          <div className="font-medium">IP rotation log</div>
          <div className="mt-3 space-y-2">
            {account.rotationLogs.length === 0 ? (
              <div className="text-sm text-muted-foreground">No rotations yet.</div>
            ) : (
              account.rotationLogs.map((log) => (
                <div key={log.id} className="rounded-lg border border px-3 py-2 text-sm">
                  <div className="font-mono text-xs">
                    {log.oldIp || "—"} → {log.newIp || "—"}
                  </div>
                  <div className="text-xs text-muted-foreground">{log.reason}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
