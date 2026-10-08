"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import AlternateEmailRoundedIcon from '@mui/icons-material/AlternateEmailRounded';
import AssignmentTurnedInRoundedIcon from '@mui/icons-material/AssignmentTurnedInRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import BarChartRoundedIcon from '@mui/icons-material/BarChartRounded';
import BusinessCenterRoundedIcon from '@mui/icons-material/BusinessCenterRounded';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import CampaignRoundedIcon from '@mui/icons-material/CampaignRounded';
import CenterFocusStrongRoundedIcon from '@mui/icons-material/CenterFocusStrongRounded';
import ContactPageRoundedIcon from '@mui/icons-material/ContactPageRounded';
import DashboardCustomizeRoundedIcon from '@mui/icons-material/DashboardCustomizeRounded';
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import GroupRoundedIcon from '@mui/icons-material/GroupRounded';
import InboxRoundedIcon from '@mui/icons-material/InboxRounded';
import KeyRoundedIcon from '@mui/icons-material/KeyRounded';
import MonitorHeartRoundedIcon from '@mui/icons-material/MonitorHeartRounded';
import NotificationsRoundedIcon from '@mui/icons-material/NotificationsRounded';
import PlayCircleRoundedIcon from '@mui/icons-material/PlayCircleRounded';
import PublicRoundedIcon from '@mui/icons-material/PublicRounded';
import RadarRoundedIcon from '@mui/icons-material/RadarRounded';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import SmartToyRoundedIcon from '@mui/icons-material/SmartToyRounded';
import SpeedRoundedIcon from '@mui/icons-material/SpeedRounded';
import SupportRoundedIcon from '@mui/icons-material/SupportRounded';


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
  icon: ComponentType<{ className?: string }>;
};

type NavGroup = {
  label: string;
  children: NavChild[];
};

const items: NavGroup[] = [
  {
    label: "Command Center",
    children: [{ label: "Overview", href: "/app", icon: DashboardRoundedIcon }],
  },
  {
    label: "Session Routing",
    children: [
      { label: "Accounts", href: "/app/accounts", icon: GroupRoundedIcon },
      { label: "Proxies", href: "/app/proxies", icon: PublicRoundedIcon },
      { label: "Sessions", href: "/app/sessions", icon: KeyRoundedIcon },
    ],
  },
  {
    label: "Automation",
    children: [
      { label: "Campaigns", href: "/app/campaigns", icon: CampaignRoundedIcon },
      { label: "Auto Posts", href: "/app/content", icon: CalendarMonthRoundedIcon },
      { label: "Templates", href: "/app/templates", icon: DashboardCustomizeRoundedIcon },
      { label: "Listeners", href: "/app/listeners", icon: RadarRoundedIcon },
      { label: "Inbox", href: "/app/inbox", icon: InboxRoundedIcon },
      { label: "Mentions", href: "/app/mentions", icon: AlternateEmailRoundedIcon },
      { label: "Approvals", href: "/app/approvals", icon: AssignmentTurnedInRoundedIcon },
      { label: "Leads", href: "/app/leads", icon: ContactPageRoundedIcon },
      { label: "Activity", href: "/app/activity", icon: MonitorHeartRoundedIcon },
    ],
  },
  {
    label: "Intelligence",
    children: [
      { label: "Agents", href: "/app/agents", icon: SmartToyRoundedIcon },
      { label: "Skills", href: "/app/skills", icon: AutoAwesomeRoundedIcon },
      { label: "Runs", href: "/app/runs", icon: PlayCircleRoundedIcon },
      { label: "Competitor Radar", href: "/app/competitors", icon: CenterFocusStrongRoundedIcon },
    ],
  },
  {
    label: "Workspace",
    children: [
      { label: "Clients", href: "/app/clients", icon: BusinessCenterRoundedIcon },
      { label: "Analytics", href: "/app/analytics", icon: BarChartRoundedIcon },
      { label: "Rate Limits", href: "/app/rate-limits", icon: SpeedRoundedIcon },
      { label: "Audit Logs", href: "/app/audit-logs", icon: ReceiptLongRoundedIcon },
      { label: "Notifications", href: "/app/notifications", icon: NotificationsRoundedIcon },
      { label: "Support", href: "/app/support", icon: SupportRoundedIcon },
      { label: "Settings", href: "/app/settings", icon: SettingsRoundedIcon },
    ],
  },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar
      collapsible="icon"
      className="text-neutral-200 [&_[data-sidebar=sidebar-inner]]:border-white/10 [&_[data-sidebar=sidebar-inner]]:bg-[#0a0f1e]/80 [&_[data-sidebar=sidebar-inner]]:backdrop-blur-xl"
    >
      <SidebarHeader className="border-b border-white/10">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              tooltip="Komenin"
              render={<Link href="/app" />}
              className="data-[slot=sidebar-menu-button]:!px-2"
            >
              <Image src="/brand/komenin-robot-256.png" alt="Komenin" width={32} height={32} />
              <span className="text-sm font-semibold tracking-tight">Komenin</span>
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
                    child.href === "/app"
                      ? pathname === "/app"
                      : pathname === child.href || pathname.startsWith(child.href + "/");
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
