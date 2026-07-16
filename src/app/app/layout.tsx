import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/app/app-sidebar";
import { AppTopbar } from "@/components/app/app-topbar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
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
    <SidebarProvider className="bg-muted/20">
      <AppSidebar />
      <SidebarInset className="bg-muted/20">
        <AppTopbar workspace={workspace} userEmail={session.user.email} />
        <div className="flex-1 px-4 py-6 md:px-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
