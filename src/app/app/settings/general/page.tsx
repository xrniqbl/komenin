import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { requireActiveWorkspace } from "@/server/workspace-access";

export default async function GeneralSettingsPage() {
  const { workspace } = await requireActiveWorkspace();
  const row = await db.workspace.findUnique({
    where: { id: workspace.id },
    select: { agencyLabel: true },
  });

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