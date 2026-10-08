"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import AccountTreeRoundedIcon from '@mui/icons-material/AccountTreeRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import BusinessRoundedIcon from '@mui/icons-material/BusinessRounded';
import ConfirmationNumberRoundedIcon from '@mui/icons-material/ConfirmationNumberRounded';
import CreditCardRoundedIcon from '@mui/icons-material/CreditCardRounded';
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import DnsRoundedIcon from '@mui/icons-material/DnsRounded';
import FlagRoundedIcon from '@mui/icons-material/FlagRounded';
import GroupRoundedIcon from '@mui/icons-material/GroupRounded';
import KeyRoundedIcon from '@mui/icons-material/KeyRounded';
import LanguageRoundedIcon from '@mui/icons-material/LanguageRounded';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import SupportRoundedIcon from '@mui/icons-material/SupportRounded';


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

const links: Array<{ href: string; label: string; icon: ComponentType<{ className?: string }> }> = [
  { href: "/admin", label: "Overview", icon: DashboardRoundedIcon },
  { href: "/admin/workspaces", label: "Workspaces", icon: BusinessRoundedIcon },
  { href: "/admin/users", label: "Users", icon: GroupRoundedIcon },
  { href: "/admin/billing", label: "Billing", icon: CreditCardRoundedIcon },
  { href: "/admin/ai", label: "AI Monetization", icon: AutoAwesomeRoundedIcon },
  { href: "/admin/vouchers", label: "Vouchers", icon: ConfirmationNumberRoundedIcon },
  { href: "/admin/connectors", label: "Connectors", icon: AccountTreeRoundedIcon },
  { href: "/admin/jobs", label: "Jobs", icon: DnsRoundedIcon },
  { href: "/admin/support", label: "Support", icon: SupportRoundedIcon },
  { href: "/admin/sso", label: "SSO", icon: KeyRoundedIcon },
  { href: "/admin/regions", label: "Regions", icon: LanguageRoundedIcon },
  { href: "/admin/flags", label: "Flags", icon: FlagRoundedIcon },
  { href: "/admin/audit", label: "Audit", icon: ReceiptLongRoundedIcon },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <SidebarProvider className="bg-marketing text-neutral-100">
      <Sidebar collapsible="icon" className="text-neutral-200 [&_[data-sidebar=sidebar-inner]]:border-white/10 [&_[data-sidebar=sidebar-inner]]:bg-[#0a0f1e]/80 [&_[data-sidebar=sidebar-inner]]:backdrop-blur-xl">
        <SidebarHeader className="border-b border-white/10">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" tooltip="Komenin Admin" render={<Link href="/admin" />}>
                <DashboardRoundedIcon className="size-4" />
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
                <ArrowBackRoundedIcon className="size-4" />
                <span>Back to app</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset className="bg-transparent">
        <header className="flex h-14 items-center gap-2 border-b border-white/10 bg-[#0a0f1e]/60 px-4 backdrop-blur-xl">
          <SidebarTrigger className="-ms-1" />
          <Separator orientation="vertical" className="mr-1 h-4" />
          <div className="text-sm font-medium">Platform control plane</div>
        </header>
        <div className="flex-1 px-4 py-6 md:px-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
