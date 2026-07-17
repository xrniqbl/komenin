import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requireActiveWorkspace } from "@/server/workspace-access";

export default async function GeneralSettingsPage() {
  const { workspace } = await requireActiveWorkspace();

  return (
    <div>
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
        </CardContent>
      </Card>
    </div>
  );
}