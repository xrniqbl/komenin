import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getPageWindow, ListPagination } from "@/components/app/list-pagination";
import { AdminListFilters } from "@/components/admin/admin-list-filters";
import {
  Empty,
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
import { adminRunJobNow, listAdminJobs } from "@/server/admin";

const STATUS_OPTIONS = [
  { value: "queued", label: "queued" },
  { value: "running", label: "running" },
  { value: "succeeded", label: "succeeded" },
  { value: "failed", label: "failed" },
];

export default async function AdminJobsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const result = await listAdminJobs({
    status: params.status,
    page: Number(params.page) || 1,
  });
  const window = getPageWindow(result.total, result.page, result.perPage);

  async function retryAction(formData: FormData) {
    "use server";
    await adminRunJobNow(String(formData.get("job") || ""));
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Job runs</h1>
        <p className="text-sm text-muted-foreground">
          Jalankan ulang men-trigger tipe job yang sama secara inline melalui
          worker (dengan re-entrancy guard).
        </p>
      </div>
      <AdminListFilters status={params.status} statusOptions={STATUS_OPTIONS} />
      <Card className="gap-0 overflow-hidden py-0">
        {result.rows.length === 0 ? (
          <Empty className="py-12">
            <EmptyHeader>
              <EmptyTitle>No job runs yet</EmptyTitle>
              <EmptyDescription>Nothing to show yet.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.job}</TableCell>
                    <TableCell>
                      <Badge variant={row.status === "failed" ? "destructive" : "secondary"}>
                        {row.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {row.startedAt.toLocaleString("id-ID", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </TableCell>
                    <TableCell className="max-w-md truncate text-muted-foreground">
                      {row.message}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.status === "failed" ? (
                        <form action={retryAction}>
                          <input type="hidden" name="job" value={row.job} />
                          <Button type="submit" variant="glass" size="sm">
                            Jalankan ulang
                          </Button>
                        </form>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <ListPagination
              pathname="/admin/jobs"
              searchParams={{ status: params.status }}
              window={window}
            />
          </>
        )}
      </Card>
    </div>
  );
}
