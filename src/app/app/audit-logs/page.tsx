import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/app/page-header";
import { listAuditLogs } from "@/server/audit-logs";

export default async function AuditLogsPage() {
  const logs = await listAuditLogs(100);

  return (
    <div>
      <PageHeader
        title="Audit Logs"
        description="Append-only trail of sensitive workspace actions."
      />

      <div className="overflow-hidden rounded-2xl border bg-background">
        {logs.length === 0 ? (
          <div className="px-4 py-10 text-sm text-muted-foreground">
            No audit events yet. Connect accounts, run health checks, or process approvals to populate this trail.
          </div>
        ) : (
          <div className="divide-y">
            {logs.map((log) => (
              <div key={log.id} className="grid gap-2 px-4 py-3 md:grid-cols-12 md:items-start">
                <div className="md:col-span-3">
                  <div className="text-sm font-medium">{log.action}</div>
                  <div className="text-xs text-muted-foreground">
                    {log.createdAt.toISOString().slice(0, 19).replace("T", " ")} UTC
                  </div>
                </div>
                <div className="md:col-span-3">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Actor</div>
                  <div className="text-sm">
                    {log.actor?.name || log.actor?.email || "system"}
                  </div>
                </div>
                <div className="md:col-span-3">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Resource</div>
                  <div className="text-sm">
                    {log.resourceType}
                    {log.resourceId ? ` · ${log.resourceId.slice(0, 10)}` : ""}
                  </div>
                </div>
                <div className="md:col-span-3">
                  <div className="flex flex-wrap gap-2">
                    {log.ip ? <Badge variant="secondary">{log.ip}</Badge> : null}
                    {log.metadata ? (
                      <Badge variant="outline">metadata</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">no metadata</span>
                    )}
                  </div>
                  {log.metadata ? (
                    <pre className="mt-2 overflow-x-auto rounded-md bg-muted/50 p-2 text-[11px] leading-relaxed text-muted-foreground">
                      {JSON.stringify(log.metadata, null, 2)}
                    </pre>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}