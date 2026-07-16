import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/app/page-header";
import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { db } from "@/lib/db";
import { createInvite } from "@/server/invites";
import { listWorkspacesForUser } from "@/server/workspaces";

export default async function TeamSettingsPage({
  searchParams,
}: {
  searchParams?: Promise<{ inviteToken?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const workspaces = await listWorkspacesForUser();
  const workspace = workspaces[0];
  if (!workspace) redirect("/onboarding");
  const params = searchParams ? await searchParams : {};

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
        {params.inviteToken ? (
          <div className="rounded-xl border bg-muted/30 px-4 py-3 text-sm">
            Invite created. Token: <code className="font-mono text-xs">{params.inviteToken}</code>
          </div>
        ) : null}

        <div className="overflow-hidden rounded-2xl border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => (
                <TableRow key={member.id}>
                  <TableCell className="font-medium">
                    {member.user.name || member.user.email}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{member.user.email}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{member.role}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

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
                  In development, invite tokens are returned in-page for testing.
                </p>
              </form>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
