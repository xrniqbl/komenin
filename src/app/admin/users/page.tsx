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
import { FormSelect } from "@/components/ui/form-select";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  adminSetPlatformRole,
  adminSetUserSuspended,
  listAdminUsers,
} from "@/server/admin";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const result = await listAdminUsers({ q: params.q, page: Number(params.page) || 1 });
  const window = getPageWindow(result.total, result.page, result.perPage);

  async function roleAction(formData: FormData) {
    "use server";
    await adminSetPlatformRole({
      userId: String(formData.get("userId") || ""),
      platformRole: String(formData.get("platformRole") || "user") as "user" | "superadmin",
    });
  }

  async function suspendAction(formData: FormData) {
    "use server";
    await adminSetUserSuspended({
      userId: String(formData.get("userId") || ""),
      suspended: String(formData.get("next") || "true") === "true",
      reason: String(formData.get("reason") || ""),
    });
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Users</h1>
      <AdminListFilters q={params.q} placeholder="Cari email / nama…" />
      <Card className="gap-0 overflow-hidden py-0">
        {result.rows.length === 0 ? (
          <Empty className="py-12">
            <EmptyHeader>
              <EmptyTitle>No users found</EmptyTitle>
              <EmptyDescription>Nothing to show yet.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Memberships</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Access</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.rows.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-2 font-medium">
                        {user.name || user.email}
                        {user.platformRole === "superadmin" ? (
                          <Badge variant="default">superadmin</Badge>
                        ) : null}
                      </div>
                      <div className="text-xs text-muted-foreground">{user.email}</div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {user._count.memberships}
                    </TableCell>
                    <TableCell>
                      <form action={roleAction} className="flex items-center gap-2">
                        <input type="hidden" name="userId" value={user.id} />
                        <FormSelect
                          name="platformRole"
                          defaultValue={user.platformRole}
                          className="min-w-32"
                          options={[
                            { value: "user", label: "user" },
                            { value: "superadmin", label: "superadmin" },
                          ]}
                        />
                        <Button type="submit" variant="glass" size="sm">
                          Update
                        </Button>
                      </form>
                    </TableCell>
                    <TableCell>
                      {user.suspendedAt ? (
                        <div className="space-y-0.5">
                          <Badge variant="destructive">suspended</Badge>
                          {user.suspendedReason ? (
                            <div className="max-w-48 truncate text-xs text-muted-foreground">
                              {user.suspendedReason}
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <Badge variant="secondary">active</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <form action={suspendAction} className="flex items-center justify-end gap-2">
                        <input type="hidden" name="userId" value={user.id} />
                        <input
                          type="hidden"
                          name="next"
                          value={user.suspendedAt ? "false" : "true"}
                        />
                        {user.suspendedAt ? null : (
                          <Input
                            name="reason"
                            placeholder="Alasan (opsional)"
                            className="max-w-44"
                          />
                        )}
                        <Button
                          type="submit"
                          variant={user.suspendedAt ? "secondary" : "destructive"}
                          size="sm"
                        >
                          {user.suspendedAt ? "Aktifkan" : "Suspend"}
                        </Button>
                      </form>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <ListPagination
              pathname="/admin/users"
              searchParams={{ q: params.q }}
              window={window}
            />
          </>
        )}
      </Card>
    </div>
  );
}
