import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { platformLabel } from "@/lib/session-routing";
import { getSession } from "@/server/sessions";

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const session = await getSession(sessionId);
  if (!session) notFound();

  const proxy = session.socialAccount.proxyAssignments[0]?.proxyEndpoint;

  return (
    <div>
      <PageHeader
        title="Session detail"
        description={`@${session.socialAccount.username} · ${platformLabel(session.socialAccount.platform)}`}
        action={
          <Link href="/app/sessions" className="text-sm text-primary">
            Back to sessions
          </Link>
        }
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Fingerprint / vault</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <div>Active: {session.isActive ? "yes" : "no"}</div>
            <div>Key version: {session.keyVersion}</div>
            <div>User agent: {session.userAgent}</div>
            <div>Encrypted payload: stored (hidden)</div>
            <div>Proxy: {proxy ? proxy.label : "Unassigned"}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent account signals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {session.socialAccount.healthChecks.map((check) => (
              <div key={check.id} className="rounded-lg border px-3 py-2">
                {check.ok ? "OK" : "Fail"} · {check.signal}
              </div>
            ))}
            {session.socialAccount.healthChecks.length === 0 ? (
              <div className="text-muted-foreground">No health checks yet.</div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}