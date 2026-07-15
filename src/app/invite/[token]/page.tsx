import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import { acceptInvite } from "@/server/invites";

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
      <div className="rounded-2xl border border bg-background p-8 shadow-xl">
        <h1 className="text-2xl font-semibold text-primary">Accept workspace invite</h1>
        <p className="mt-2 text-md text-muted-foreground">
          Continue as {session.user.email} to join the workspace.
        </p>
        <form action={accept} className="mt-8">
          <Button type="submit" variant="default" size="lg" className="w-full">
            Accept invite
          </Button>
        </form>
      </div>
    </div>
  );
}
