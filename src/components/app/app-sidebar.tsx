"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";

const items = [
  {
    label: "Command Center",
    children: [{ label: "Overview", href: "/app" }],
  },
  {
    label: "Session Routing",
    children: [
      { label: "Accounts", href: "/app/accounts" },
      { label: "Proxies", href: "/app/proxies" },
      { label: "Sessions", href: "/app/sessions" },
    ],
  },
  {
    label: "Automation",
    children: [
      { label: "Campaigns", href: "/app/campaigns" },
      { label: "Auto Posts", href: "/app/content" },
      { label: "Templates", href: "/app/templates" },
      { label: "Listeners", href: "/app/listeners" },
      { label: "Inbox", href: "/app/inbox" },
      { label: "Approvals", href: "/app/approvals" },
      { label: "Activity", href: "/app/activity" },
    ],
  },
  {
    label: "Intelligence",
    children: [
      { label: "Agents", href: "/app/agents" },
      { label: "Skills", href: "/app/skills" },
      { label: "Runs", href: "/app/runs" },
      { label: "Competitor Radar", href: "/app/competitors" },
    ],
  },
  {
    label: "Workspace",
    children: [
      { label: "Analytics", href: "/app/analytics" },
      { label: "Rate Limits", href: "/app/rate-limits" },
      { label: "Audit Logs", href: "/app/audit-logs" },
      { label: "Notifications", href: "/app/notifications" },
      { label: "Settings", href: "/app/settings" },
    ],
  },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              tooltip="Aether"
              render={<Link href="/app" />}
              className="data-[slot=sidebar-menu-button]:!px-2"
            >
              <Image src="/brand/aether-mono.svg" alt="Aether" width={24} height={24} />
              <span className="text-sm font-semibold tracking-tight">Aether</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {items.map((item) => (
          <SidebarGroup key={item.label}>
            <SidebarGroupLabel>{item.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {item.children.map((child) => {
                  const isActive =
                    pathname === child.href || pathname.startsWith(`${child.href}/`);
                  return (
                    <SidebarMenuItem key={child.href}>
                      <SidebarMenuButton
                        isActive={isActive}
                        tooltip={child.label}
                        render={<Link href={child.href} />}
                      >
                        <span>{child.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
