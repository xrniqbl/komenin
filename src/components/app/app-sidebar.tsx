"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export const APP_NAV = [
  { label: "Command Center", href: "/app" },
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
    ],
  },
  {
    label: "Insights",
    children: [
      { label: "Analytics", href: "/app/analytics" },
      { label: "Audit Logs", href: "/app/audit-logs" },
    ],
  },
  { label: "Settings", href: "/app/settings" },
] as const;

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-72 shrink-0 flex-col border-r bg-background">
      <div className="border-b px-5 py-5 text-base font-semibold">Aether</div>
      <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 py-4">
        {APP_NAV.map((item) => (
          <div key={item.label} className="flex flex-col gap-1">
            {"href" in item && item.href ? (
              <Link
                href={item.href}
                className={cn(
                  "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  pathname === item.href
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )}
              >
                {item.label}
              </Link>
            ) : (
              <div className="px-3 py-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {item.label}
              </div>
            )}
            {"children" in item && item.children
              ? item.children.map((child) => (
                  <Link
                    key={child.href}
                    href={child.href}
                    className={cn(
                      "rounded-md px-3 py-2 text-sm transition-colors",
                      pathname === child.href || pathname.startsWith(child.href + "/")
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                    )}
                  >
                    {child.label}
                  </Link>
                ))
              : null}
          </div>
        ))}
      </nav>
    </aside>
  );
}
