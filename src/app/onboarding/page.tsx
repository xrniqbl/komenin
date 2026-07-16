import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { auth } from "@/lib/auth";
import { createInvite } from "@/server/invites";
import { createWorkspace, listWorkspacesForUser } from "@/server/workspaces";

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const workspaces = await listWorkspacesForUser();
  if (workspaces.length > 0) redirect("/app");

  async function completeOnboarding(formData: FormData) {
    "use server";
    const name = String(formData.get("name") || "").trim();
    const timezone = String(formData.get("timezone") || "Asia/Jakarta");
    const invitesRaw = String(formData.get("invites") || "");
    const workspace = await createWorkspace({ name, timezone });

    const emails = invitesRaw
      .split(/[,\n]/)
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);

    for (const email of emails) {
      await createInvite({
        workspaceId: workspace.id,
        email,
        role: "operator",
      });
    }

    redirect("/app");
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-lg items-center px-4 py-12">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Create your workspace</CardTitle>
          <CardDescription>
            Set up the control plane for Instagram, Threads, and TikTok operations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form action={completeOnboarding} className="flex flex-col gap-4">
            <Field name="name">
              <FieldLabel htmlFor="name">Workspace name</FieldLabel>
              <Input id="name" name="name" required placeholder="Acme Growth" />
            </Field>
            <Field name="timezone">
              <FieldLabel htmlFor="timezone">Timezone</FieldLabel>
              <Input id="timezone" name="timezone" defaultValue="Asia/Jakarta" />
              <FieldDescription>Used for schedules, audit timestamps, and digests.</FieldDescription>
            </Field>
            <Field name="invites">
              <FieldLabel htmlFor="invites">Invite teammates (optional)</FieldLabel>
              <Textarea
                id="invites"
                name="invites"
                placeholder="ops@company.com, analyst@company.com"
              />
              <FieldDescription>Comma-separated emails. Invites can also be sent later.</FieldDescription>
            </Field>
            <div className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
              Platforms ready in product model: Instagram, Threads, TikTok.
            </div>
            <Button type="submit" size="lg">
              Launch command center
            </Button>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
