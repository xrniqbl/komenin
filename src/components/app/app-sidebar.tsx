"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BarChart3,
  Bell,
  Bot,
  CalendarDays,
  ClipboardCheck,
  Crosshair,
  Gauge,
  Globe,
  Inbox,
  KeyRound,
  LayoutDashboard,
  LayoutTemplate,
  Megaphone,
  PlayCircle,
  Radar,
  ScrollText,
  Settings,
  Sparkles,
  Users,
} from "lucide-react";
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

type NavChild = {
  label: string;
  href: string;
  icon: LucideIcon;
};

type NavGroup = {
  label: string;
  children: NavChild[];
};

const items: NavGroup[] = [
  {
    label: "Command Center",
    children: [{ label: "Overview", href: "/app", icon: LayoutDashboard }],
  },
  {
    label: "Session Routing",
    children: [
      { label: "Accounts", href: "/app/accounts", icon: Users },
      { label: "Proxies", href: "/app/proxies", icon: Globe },
      { label: "Sessions", href: "/app/sessions", icon: KeyRound },
    ],
  },
  {
    label: "Automation",
    children: [
      { label: "Campaigns", href: "/app/campaigns", icon: Megaphone },
      { label: "Auto Posts", href: "/app/content", icon: CalendarDays },
      { label: "Templates", href: "/app/templates", icon: LayoutTemplate },
      { label: "Listeners", href: "/app/listeners", icon: Radar },
      { label: "Inbox", href: "/app/inbox", icon: Inbox },
      { label: "Approvals", href: "/app/approvals", icon: ClipboardCheck },
      { label: "Activity", href: "/app/activity", icon: Activity },
    ],
  },
  {
    label: "Intelligence",
    children: [
      { label: "Agents", href: "/app/agents", icon: Bot },
      { label: "Skills", href: "/app/skills", icon: Sparkles },
      { label: "Runs", href: "/app/runs", icon: PlayCircle },
      { label: "Competitor Radar", href: "/app/competitors", icon: Crosshair },
    ],
  },
  {
    label: "Workspace",
    children: [
      { label: "Analytics", href: "/app/analytics", icon: BarChart3 },
      { label: "Rate Limits", href: "/app/rate-limits", icon: Gauge },
      { label: "Audit Logs", href: "/app/audit-logs", icon: ScrollText },
      { label: "Notifications", href: "/app/notifications", icon: Bell },
      { label: "Settings", href: "/app/settings", icon: Settings },
    ],
  },
];

export function AppSidebar() {
  const pathname = usePathname();
  const prefix = "/";

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
                  const Icon = child.icon;
                  const isActive =
                    pathname === child.href || pathname.startsWith(child.href + prefix);
                  return (
                    <SidebarMenuItem key={child.href}>
                      <SidebarMenuButton
                        isActive={isActive}
                        tooltip={child.label}
                        render={<Link href={child.href} />}
                      >
                        <Icon className="size-4" />
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
