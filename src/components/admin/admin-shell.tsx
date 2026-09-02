"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  Building2,
  CreditCard,
  Flag,
  Globe2,
  KeyRound,
  LayoutDashboard,
  ScrollText,
  ServerCog,
  Sparkles,
  TicketPercent,
  Users,
  Workflow,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";

const links: Array<{ href: string; label: string; icon: LucideIcon }> = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/workspaces", label: "Workspaces", icon: Building2 },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/billing", label: "Billing", icon: CreditCard },
  { href: "/admin/ai", label: "AI Monetization", icon: Sparkles },
  { href: "/admin/vouchers", label: "Vouchers", icon: TicketPercent },
  { href: "/admin/connectors", label: "Connectors", icon: Workflow },
  { href: "/admin/jobs", label: "Jobs", icon: ServerCog },
  { href: "/admin/sso", label: "SSO", icon: KeyRound },
  { href: "/admin/regions", label: "Regions", icon: Globe2 },
  { href: "/admin/flags", label: "Flags", icon: Flag },
  { href: "/admin/audit", label: "Audit", icon: ScrollText },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader className="border-b border-sidebar-border">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" tooltip="Komenin Admin" render={<Link href="/admin" />}>
                <LayoutDashboard className="size-4" />
                <span className="text-sm font-semibold tracking-tight">Komenin Admin</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {links.map((link) => {
                  const Icon = link.icon;
                  const isActive =
                    link.href === "/admin"
                      ? pathname === "/admin"
                      : pathname === link.href || pathname.startsWith(`${link.href}/`);
                  return (
                    <SidebarMenuItem key={link.href}>
                      <SidebarMenuButton
                        isActive={isActive}
                        tooltip={link.label}
                        render={<Link href={link.href} />}
                      >
                        <Icon className="size-4" />
                        <span>{link.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton tooltip="Back to app" render={<Link href="/app" />}>
                <ArrowLeft className="size-4" />
                <span>Back to app</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset>
        <header className="flex h-14 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ms-1" />
          <Separator orientation="vertical" className="mr-1 h-4" />
          <div className="text-sm font-medium">Platform control plane</div>
        </header>
        <div className="flex-1 px-4 py-6 md:px-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
