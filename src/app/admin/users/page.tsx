import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { FormSelect } from "@/components/ui/form-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { adminSetPlatformRole, listAdminUsers } from "@/server/admin";

export default async function AdminUsersPage() {
  const users = await listAdminUsers();

  async function roleAction(formData: FormData) {
    "use server";
    await adminSetPlatformRole({
      userId: String(formData.get("userId") || ""),
      platformRole: String(formData.get("platformRole") || "user") as "user" | "superadmin",
    });
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Users</h1>
      <Card className="gap-0 overflow-hidden py-0">
        {users.length === 0 ? (
          <Empty className="py-12">
            <EmptyHeader>
              <EmptyTitle>No users found</EmptyTitle>
              <EmptyDescription>Nothing to show yet.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Memberships</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="font-medium">{user.name || user.email}</div>
                    <div className="text-xs text-muted-foreground">{user.email}</div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{user._count.memberships}</TableCell>
                  <TableCell colSpan={2}>
                    <form action={roleAction} className="flex items-center justify-end gap-2">
                      <input type="hidden" name="userId" value={user.id} />
                      <FormSelect
                        name="platformRole"
                        defaultValue={user.platformRole}
                        className="min-w-36"
                        options={[
                          { value: "user", label: "user" },
                          { value: "superadmin", label: "superadmin" },
                        ]}
                      />
                      <Button type="submit" variant="outline" size="sm">
                        Update
                      </Button>
                    </form>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
