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
    <div className="bg-marketing relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute top-1/4 left-1/4 h-72 w-72 rounded-full bg-electric-500/12 blur-[120px]" />
        <div className="absolute right-1/4 bottom-1/4 h-72 w-72 rounded-full bg-purple-500/10 blur-[120px]" />
      </div>
      <div className="relative w-full max-w-md">
      <Card className="glass-strong w-full rounded-3xl p-2">
        <CardHeader>
          <CardTitle className="text-2xl text-white">Accept workspace invite</CardTitle>
          <CardDescription>
            Continue as {session.user.email} to join the workspace.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={accept}>
            <Button type="submit" variant="electric" size="lg" className="w-full rounded-full">
              Accept invite
            </Button>
          </form>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}