import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/app/app-sidebar";
import { AppTopbar } from "@/components/app/app-topbar";
import { auth } from "@/lib/auth";
import { listWorkspacesForUser } from "@/server/workspaces";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const workspaces = await listWorkspacesForUser();
  if (workspaces.length === 0) redirect("/onboarding");

  const workspace = workspaces[0];

  return (
    <div className="flex min-h-screen bg-muted/20">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppTopbar workspace={workspace} userEmail={session.user.email} />
        <main className="flex-1 px-4 py-6 md:px-6">{children}</main>
      </div>
    </div>
  );
}
