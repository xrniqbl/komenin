import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { StatusPill } from "@/components/session-routing/status-pill";
import { platformLabel } from "@/lib/session-routing";
import { listSessions } from "@/server/sessions";

export default async function SessionsPage() {
  const sessions = await listSessions();

  return (
    <div>
      <PageHeader
        title="Sessions"
        description="Anti-detect session vault health and reconnect candidates."
      />

      <div className="overflow-hidden rounded-2xl border border bg-background">
        <div className="grid grid-cols-12 gap-2 border-b border bg-muted/30 px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <div className="col-span-3">Account</div>
          <div className="col-span-2">Platform</div>
          <div className="col-span-3">User agent</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-2">Updated</div>
        </div>

        {sessions.length === 0 ? (
          <div className="px-4 py-10 text-sm text-muted-foreground">No sessions imported yet.</div>
        ) : (
          sessions.map((session) => (
            <div key={session.id} className="grid grid-cols-12 items-center gap-2 border-b border px-4 py-3 text-sm last:border-b-0">
              <div className="col-span-3">
                <Link href={`/app/sessions/${session.id}`} className="font-medium hover:text-primary">
                  @{session.socialAccount.username}
                </Link>
              </div>
              <div className="col-span-2">{platformLabel(session.socialAccount.platform)}</div>
              <div className="col-span-3 truncate text-xs text-muted-foreground">{session.userAgent}</div>
              <div className="col-span-2">
                <StatusPill
                  label={session.isActive ? "active" : "inactive"}
                  color={session.isActive ? "var(--signal-ok)" : "var(--ink-500)"}
                />
              </div>
              <div className="col-span-2 text-xs text-muted-foreground">
                {session.updatedAt.toISOString().slice(0, 16).replace("T", " ")}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
