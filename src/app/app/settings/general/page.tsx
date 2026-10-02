import Link from "next/link";
import { revalidatePath } from "next/cache";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { db } from "@/lib/db";
import { canWithCustom } from "@/lib/rbac";
import { updateWorkspaceSettings } from "@/server/workspaces";
import { requireActiveWorkspace } from "@/server/workspace-access";

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export default async function GeneralSettingsPage() {
  const { workspace } = await requireActiveWorkspace();
  const row = await db.workspace.findUnique({
    where: { id: workspace.id },
    select: {
      agencyLabel: true,
      timezone: true,
      quietHoursStart: true,
      quietHoursEnd: true,
    },
  });

  const canManage = canWithCustom(workspace.role, workspace.customPermissions, "settings.manage");

  async function saveScheduling(formData: FormData) {
    "use server";
    const timezone = String(formData.get("timezone") || "");
    const quietHoursStart = Number(formData.get("quietHoursStart"));
    const quietHoursEnd = Number(formData.get("quietHoursEnd"));
    await updateWorkspaceSettings({ timezone, quietHoursStart, quietHoursEnd });
    revalidatePath("/app/settings/general");
  }

  return (
    <div className="space-y-6">
      <PageHeader title="General" description="Workspace identity and defaults." />
      <Card className="max-w-xl">
        <CardContent className="space-y-4 pt-6">
          <div>
            <div className="text-sm text-muted-foreground">Name</div>
            <div className="mt-1 font-medium">{workspace.name}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Slug</div>
            <div className="mt-1 font-medium">{workspace.slug}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Your role</div>
            <div className="mt-1 font-medium">{workspace.role}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Agency label</div>
            <div className="mt-1 font-medium">{row?.agencyLabel || "—"}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Plan</div>
            <div className="mt-1 font-medium">{workspace.planCode}</div>
          </div>
        </CardContent>
      </Card>

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle className="text-base">Scheduling</CardTitle>
          <CardDescription>
            Timezone and quiet hours for automated delivery. Quiet hours pause sends;
            scheduled comments are retried once the window ends.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={saveScheduling} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="timezone">Workspace timezone (IANA)</Label>
              <input
                id="timezone"
                name="timezone"
                defaultValue={row?.timezone || "Asia/Jakarta"}
                disabled={!canManage}
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring disabled:opacity-50"
                placeholder="Asia/Jakarta"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quietHoursStart">Quiet start (hour)</Label>
                <select
                  id="quietHoursStart"
                  name="quietHoursStart"
                  defaultValue={row?.quietHoursStart ?? 0}
                  disabled={!canManage}
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none disabled:opacity-50"
                >
                  {HOURS.map((hour) => (
                    <option key={hour} value={hour}>
                      {String(hour).padStart(2, "0")}:00
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="quietHoursEnd">Quiet end (hour)</Label>
                <select
                  id="quietHoursEnd"
                  name="quietHoursEnd"
                  defaultValue={row?.quietHoursEnd ?? 0}
                  disabled={!canManage}
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none disabled:opacity-50"
                >
                  {HOURS.map((hour) => (
                    <option key={hour} value={hour}>
                      {String(hour).padStart(2, "0")}:00
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Set the same start and end hour to disable quiet hours. Overnight windows
              (e.g. 22:00–06:00) are supported.
            </p>
            {canManage ? <Button type="submit">Save scheduling</Button> : null}
          </form>
        </CardContent>
      </Card>

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle className="text-base">Agency clients</CardTitle>
          <CardDescription>
            Tag leads and campaigns by client brand without spinning up separate tenants.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button render={<Link href="/app/clients" />} nativeButton={false}>
            Manage clients
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
