import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/app/page-header";
import { StatusPill } from "@/components/session-routing/status-pill";
import { platformLabel, statusTone } from "@/lib/session-routing";
import { getAccount, rotateAccountIp, runAccountHealthCheck } from "@/server/accounts";
import { ReimportSessionForm } from "@/components/accounts/reimport-session-form";

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
        <Card className="md:col-span-2">
          <CardHeader>
            <div className="flex flex-wrap items-center gap-3">
              <StatusPill label={account.status} color={statusTone(account.status)} />
              <span className="text-sm text-muted-foreground">Health score {account.healthScore}</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
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

            <div className="flex gap-2">
              <form
                action={async () => {
                  "use server";
                  await runAccountHealthCheck(account.id);
                }}
              >
                <Button variant="outline" type="submit">
                  Run health probe
                </Button>
              </form>
              <form
                action={async () => {
                  "use server";
                  await rotateAccountIp(account.id, "detail_manual_rotate");
                }}
              >
                <Button variant="default" type="submit">
                  Rotate IP
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Session vault</CardTitle>
            <CardDescription>
              Cookies/tokens are stored encrypted at rest. Raw secrets are never rendered in the UI.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {activeSession ? (
              <div className="space-y-2">
                <div>
                  UA:{" "}
                  <span className="text-muted-foreground">
                    {activeSession.userAgent.slice(0, 48)}…
                  </span>
                </div>
                <div>Key version: {activeSession.keyVersion}</div>
                <div>Active: {activeSession.isActive ? "yes" : "no"}</div>
              </div>
            ) : (
              <div className="text-muted-foreground">No active session.</div>
            )}
            <div className="border-t pt-4">
              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Re-import production session
              </div>
              <ReimportSessionForm accountId={account.id} platform={account.platform} />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent health checks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {account.healthChecks.length === 0 ? (
              <div className="text-sm text-muted-foreground">No probes yet.</div>
            ) : (
              account.healthChecks.map((check) => (
                <div key={check.id} className="rounded-lg border px-3 py-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span>{check.ok ? "OK" : "Fail"} · {check.signal}</span>
                    <span className="text-xs text-muted-foreground">{check.latencyMs ?? "—"} ms</span>
                  </div>
                  <div className="text-xs text-muted-foreground">{check.details}</div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">IP rotation log</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {account.rotationLogs.length === 0 ? (
              <div className="text-sm text-muted-foreground">No rotations yet.</div>
            ) : (
              account.rotationLogs.map((log) => (
                <div key={log.id} className="rounded-lg border px-3 py-2 text-sm">
                  <div className="font-mono text-xs">
                    {log.oldIp || "—"} → {log.newIp || "—"}
                  </div>
                  <div className="text-xs text-muted-foreground">{log.reason}</div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}