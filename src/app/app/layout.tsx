import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/app/app-sidebar";
import { AppTopbar } from "@/components/app/app-topbar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { auth } from "@/lib/auth";
import { buildMetadata } from "@/lib/seo";
import { requireActiveWorkspace } from "@/server/workspace-access";

export const metadata: Metadata = buildMetadata({
  title: "Workspace",
  description: "Komenin workspace command center.",
  path: "/app",
  noIndex: true,
});

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { workspace, workspaces } = await requireActiveWorkspace();

  return (
    <SidebarProvider className="bg-marketing text-neutral-100">
      <AppSidebar />
      <SidebarInset className="bg-transparent">
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-32 left-1/2 h-96 w-[60rem] -translate-x-1/2 rounded-full bg-electric-600/15 blur-3xl" />
          <div className="absolute top-1/3 -left-32 h-80 w-80 rounded-full bg-electric-500/10 blur-3xl" />
          <div className="absolute -right-32 bottom-0 h-80 w-80 rounded-full bg-electric-400/10 blur-3xl" />
        </div>
        <div className="relative flex flex-1 flex-col">
          <AppTopbar
            workspace={workspace}
            workspaces={workspaces}
            userEmail={session.user.email}
          />
          <div className="flex-1 px-4 py-6 md:px-6">{children}</div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
