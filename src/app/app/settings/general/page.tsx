import { redirect } from "next/navigation";
import { PageHeader } from "@/components/app/page-header";
import { auth } from "@/lib/auth";
import { listWorkspacesForUser } from "@/server/workspaces";

export default async function GeneralSettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const workspaces = await listWorkspacesForUser();
  const workspace = workspaces[0];
  if (!workspace) redirect("/onboarding");

  return (
    <div>
      <PageHeader title="General" description="Workspace identity and defaults." />
      <div className="max-w-xl space-y-4 rounded-2xl border border bg-background p-6">
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
      </div>
    </div>
  );
}
