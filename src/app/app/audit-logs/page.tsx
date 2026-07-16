import { FilterBar } from "@/components/app/filter-bar";
import { ListPagination, paginateItems } from "@/components/app/list-pagination";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Textarea } from "@/components/ui/textarea";
import { exportAuditLogsCsv } from "@/server/audit-export";
import { listAuditLogs } from "@/server/audit-logs";

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; export?: string; page?: string }>;
}) {
  const params = await searchParams;
  const logs = await listAuditLogs({ q: params.q, limit: 200 });
  const { items, window } = paginateItems(logs, params.page, 20);
  const exported = params.export === "1" ? await exportAuditLogsCsv(2000) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Logs"
        description="Append-only trail of sensitive workspace actions."
        action={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              render={<a href={`/app/audit-logs?${new URLSearchParams({ ...(params.q ? { q: params.q } : {}), export: "1" }).toString()}`} />}
              nativeButton={false}
            >
              Export CSV
            </Button>
          </div>
        }
      />

      <FilterBar placeholder="Search logs by action or resource..." defaultQ={params.q || ""} />

      {exported ? (
        <Dialog defaultOpen>
          <DialogPopup className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Export ready</DialogTitle>
              <DialogDescription>
                {exported.count} rows · {exported.filename}
              </DialogDescription>
            </DialogHeader>
            <div className="px-6 pb-2">
              <Textarea readOnly className="h-56 font-mono text-[11px]" value={exported.csv} />
              <div className="mt-2 text-xs text-muted-foreground">
                Copy the CSV contents and save as a file for compliance archives.
              </div>
            </div>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>Close</DialogClose>
              <Button render={<a href="/app/audit-logs" />} nativeButton={false}>
                Back to logs
              </Button>
            </DialogFooter>
          </DialogPopup>
        </Dialog>
      ) : null}

      <div className="overflow-hidden rounded-2xl border bg-background">
        {items.length === 0 ? (
          <Empty className="py-12">
            <EmptyHeader>
              <EmptyTitle>No audit events found</EmptyTitle>
              <EmptyDescription>
                {params.q
                  ? "Try a different search."
                  : "Connect accounts, run health checks, or process approvals to populate this trail."}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <>
            <div className="divide-y">
              {items.map((log) => (
                <div key={log.id} className="grid gap-2 px-4 py-3 md:grid-cols-12 md:items-start">
                  <div className="md:col-span-3">
                    <div className="text-sm font-medium">{log.action}</div>
                    <div className="text-xs text-muted-foreground">
                      {log.createdAt.toISOString().slice(0, 19).replace("T", " ")} UTC
                    </div>
                  </div>
                  <div className="md:col-span-3">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Actor</div>
                    <div className="text-sm">{log.actor?.name || log.actor?.email || "system"}</div>
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
            <ListPagination
              pathname="/app/audit-logs"
              searchParams={{ q: params.q }}
              window={window}
            />
          </>
        )}
      </div>
    </div>
  );
}
