import { redirect } from "next/navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { can } from "@/lib/rbac";
import { db } from "@/lib/db";
import { createInvite } from "@/server/invites";
import { requireActiveWorkspace } from "@/server/workspace-access";

export default async function TeamSettingsPage({
  searchParams,
}: {
  searchParams?: Promise<{ inviteToken?: string; emailed?: string }>;
}) {
  const { workspace } = await requireActiveWorkspace();
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
    redirect(
      `/app/settings/team?inviteToken=${result.token}&emailed=${result.emailDelivered ? "1" : "0"}`,
    );
  }

  return (
    <div>
      <PageHeader title="Team" description="Members and invitations." />
      <div className="flex flex-col gap-6">
        {params.inviteToken ? (
          <Alert variant="info">
            <AlertTitle>Invite created</AlertTitle>
            <AlertDescription>
              {params.emailed === "1" ? (
                <>Invitation email sent. A manual link is also available:</>
              ) : (
                <>
                  Email delivery is not configured (set{" "}
                  <code className="font-mono text-xs">BREVO_API_KEY</code>), so
                  share this token manually:
                </>
              )}{" "}
              <code className="font-mono text-xs">{params.inviteToken}</code>
            </AlertDescription>
          </Alert>
        ) : null}

        <Card className="gap-0 overflow-hidden py-0">
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
