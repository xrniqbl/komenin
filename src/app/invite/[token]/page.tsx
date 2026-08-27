import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { acceptInvite } from "@/server/invites";

export const metadata: Metadata = {
  title: "Workspace invite",
  robots: { index: false, follow: false },
};

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const session = await auth();
  const { token } = await params;
  if (!session?.user) redirect(`/login?callbackUrl=/invite/${token}`);

  async function accept() {
    "use server";
    await acceptInvite(token);
    redirect("/app");
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl text-primary">Accept workspace invite</CardTitle>
          <CardDescription>
            Continue as {session.user.email} to join the workspace.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={accept}>
            <Button type="submit" variant="default" size="lg" className="w-full">
              Accept invite
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}