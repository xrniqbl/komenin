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
      className="text-neutral-200 [&_[data-sidebar=sidebar-inner]]:border-r [&_[data-sidebar=sidebar-inner]]:border-white/[0.06] [&_[data-sidebar=sidebar-inner]]:bg-[#080c16]"
    >
      <SidebarHeader className="border-b border-white/[0.06] bg-[#080c16]">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              tooltip="Komenin"
              render={<Link href="/app" />}
              className="data-[slot=sidebar-menu-button]:!px-2 hover:bg-white/[0.04] group-data-[collapsible=icon]:!size-8 group-data-[collapsible=icon]:!p-0"
            >
              <span className="flex size-7 items-center justify-center rounded-md bg-electric-600">
                <Image src="/brand/komenin-robot-256.png" alt="Komenin" width={16} height={16} className="brightness-0 invert" />
              </span>
              <span className="text-sm font-semibold tracking-tight text-white">Komenin</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent className="bg-[#080c16] px-2">
        {items.map((item) => (
          <SidebarGroup key={item.label} className="py-1">
            <SidebarGroupLabel className="px-2 text-[11px] font-medium uppercase tracking-wider text-neutral-500">
              {item.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
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
                        className="h-8 rounded-md text-[13px] text-neutral-400 hover:bg-white/[0.04] hover:text-white data-[active=true]:bg-electric-600/15 data-[active=true]:text-white data-[active=true]:shadow-[inset_0_0_0_1px_rgba(46,124,246,0.25)] group-data-[collapsible=icon]:!size-8 group-data-[collapsible=icon]:!p-0"
                      >
                        <Icon className="size-3.5 shrink-0" />
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
      <SidebarRail className="bg-[#080c16]" />
    </Sidebar>
  );
}
