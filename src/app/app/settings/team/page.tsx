import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/app/page-header";
import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { db } from "@/lib/db";
import { createInvite } from "@/server/invites";
import { listWorkspacesForUser } from "@/server/workspaces";

export default async function TeamSettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const workspaces = await listWorkspacesForUser();
  const workspace = workspaces[0];
  if (!workspace) redirect("/onboarding");

  const members = await db.membership.findMany({
    where: { workspaceId: workspace.id, status: "active" },
    include: { user: true },
    orderBy: { createdAt: "asc" },
  });

  const canInvite = can(workspace.role, "members.manage");

  async function inviteMember(formData: FormData) {
    "use server";
    const email = String(formData.get("email") || "");
    const result = await createInvite({
      workspaceId: workspace.id,
      email,
      role: "operator",
    });
    redirect(`/app/settings/team?inviteToken=${result.token}`);
  }

  return (
    <div>
      <PageHeader title="Team" description="Members and invitations." />
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Members</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {members.map((member) => (
              <div key={member.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                <div>
                  <div className="text-sm font-medium">{member.user.name || member.user.email}</div>
                  <div className="text-xs text-muted-foreground">{member.user.email}</div>
                </div>
                <Badge variant="secondary">{member.role}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        {canInvite ? (
          <Card className="max-w-xl">
            <CardHeader>
              <CardTitle>Invite member</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={inviteMember} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" name="email" type="email" required placeholder="teammate@company.com" />
                </div>
                <Button type="submit">Create invite</Button>
                <p className="text-xs text-muted-foreground">
                  In development, invite tokens are returned via query string for manual sharing.
                </p>
              </form>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
