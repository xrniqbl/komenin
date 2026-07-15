import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/app/page-header";
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
        <div className="rounded-2xl border border bg-background p-5 text-sm">
          <div className="font-medium">Fingerprint / vault</div>
          <div className="mt-4 space-y-2 text-muted-foreground">
            <div>Active: {session.isActive ? "yes" : "no"}</div>
            <div>Key version: {session.keyVersion}</div>
            <div>User agent: {session.userAgent}</div>
            <div>Encrypted payload: stored (hidden)</div>
            <div>Proxy: {proxy ? proxy.label : "Unassigned"}</div>
          </div>
        </div>

        <div className="rounded-2xl border border bg-background p-5">
          <div className="font-medium">Recent account signals</div>
          <div className="mt-3 space-y-2 text-sm">
            {session.socialAccount.healthChecks.map((check) => (
              <div key={check.id} className="rounded-lg border border px-3 py-2">
                {check.ok ? "OK" : "Fail"} · {check.signal}
              </div>
            ))}
            {session.socialAccount.healthChecks.length === 0 ? (
              <div className="text-muted-foreground">No health checks yet.</div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
