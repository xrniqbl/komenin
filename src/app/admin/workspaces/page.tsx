import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getPageWindow, ListPagination } from "@/components/app/list-pagination";
import { AdminListFilters } from "@/components/admin/admin-list-filters";
import { FormSelect } from "@/components/ui/form-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adminUpdateWorkspace, listAdminWorkspaces } from "@/server/admin";

export default async function AdminWorkspacesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const result = await listAdminWorkspaces({ q: params.q, page: Number(params.page) || 1 });
  const window = getPageWindow(result.total, result.page, result.perPage);

  async function updateAction(formData: FormData) {
    "use server";
    // Empty input = leave unchanged; explicit 0 must stay 0 (not undefined).
    const parseLimit = (raw: FormDataEntryValue | null): number | undefined => {
      const s = String(raw ?? "").trim();
      if (!s) return undefined;
      const n = Number(s);
      return Number.isFinite(n) && n >= 0 ? Math.floor(n) : undefined;
    };
    await adminUpdateWorkspace({
      workspaceId: String(formData.get("workspaceId") || ""),
      status: String(formData.get("status") || "active") as "active" | "suspended",
      planCode: String(formData.get("planCode") || "").trim(),
      monthlySendLimit: parseLimit(formData.get("monthlySendLimit")),
      monthlyPublishLimit: parseLimit(formData.get("monthlyPublishLimit")),
      homeRegion: String(formData.get("homeRegion") || "").trim() || undefined,
    });
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Workspaces</h1>
      <AdminListFilters q={params.q} placeholder="Cari nama / slug…" />
      <p className="text-xs text-muted-foreground">
        {result.total} workspace
      </p>
      <div className="space-y-3">
        {result.rows.map((ws) => (
          <Card key={ws.id}>
            <CardContent className="pt-6">
              <form action={updateAction} className="space-y-3 text-sm">
                <input type="hidden" name="workspaceId" value={ws.id} />
                <div className="font-medium">
                  {ws.name} <span className="text-muted-foreground">({ws.slug})</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  members {ws._count.memberships} · accounts {ws._count.socialAccounts} · sub{" "}
                  {ws.subscriptions[0]?.plan.code || "none"}
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor={`status-${ws.id}`}>Status</Label>
                    <FormSelect
                      id={`status-${ws.id}`}
                      name="status"
                      defaultValue={ws.status}
                      options={[
                        { value: "active", label: "active" },
                        { value: "suspended", label: "suspended" },
                      ]}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor={`planCode-${ws.id}`}>Plan code</Label>
                    <Input id={`planCode-${ws.id}`} name="planCode" defaultValue={ws.planCode} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor={`monthlySendLimit-${ws.id}`}>Monthly send limit</Label>
                    <Input
                      id={`monthlySendLimit-${ws.id}`}
                      name="monthlySendLimit"
                      type="number"
                      defaultValue={ws.monthlySendLimit}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor={`monthlyPublishLimit-${ws.id}`}>Monthly publish limit</Label>
                    <Input
                      id={`monthlyPublishLimit-${ws.id}`}
                      name="monthlyPublishLimit"
                      type="number"
                      defaultValue={ws.monthlyPublishLimit}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor={`homeRegion-${ws.id}`}>Home region</Label>
                    <Input id={`homeRegion-${ws.id}`} name="homeRegion" defaultValue={ws.homeRegion} />
                  </div>
                </div>
                <Button type="submit" size="sm">
                  Save
                </Button>
              </form>
            </CardContent>
          </Card>
        ))}
      </div>
      <ListPagination
        pathname="/admin/workspaces"
        searchParams={{ q: params.q }}
        window={window}
      />
    </div>
  );
}
