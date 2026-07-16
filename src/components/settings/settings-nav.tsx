"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const SETTINGS_LINKS = [
  { href: "/app/settings/general", label: "General" },
  { href: "/app/settings/team", label: "Team" },
  { href: "/app/settings/ai", label: "AI" },
  { href: "/app/settings/risk-rules", label: "Risk Rules" },
  { href: "/app/settings/publisher", label: "Publisher" },
  { href: "/app/settings/webhooks", label: "Webhooks" },
  { href: "/app/settings/api-keys", label: "API Keys" },
  { href: "/app/settings/roles", label: "Roles" },
  { href: "/app/settings/billing", label: "Billing" },
  { href: "/app/settings/security", label: "Security" },
] as const;

export function SettingsNav() {
  const pathname = usePathname();
  const router = useRouter();
  const active =
    SETTINGS_LINKS.find(
      (link) => pathname === link.href || pathname.startsWith(`${link.href}/`),
    )?.href || SETTINGS_LINKS[0].href;

  return (
    <Tabs
      value={active}
      onValueChange={(value) => {
        if (typeof value === "string" && value && value !== pathname) {
          router.push(value);
        }
      }}
      className="mb-6"
    >
      <TabsList variant="line" className="h-auto w-full justify-start gap-1 overflow-x-auto">
        {SETTINGS_LINKS.map((link) => (
          <TabsTrigger
            key={link.href}
            value={link.href}
            render={<Link href={link.href} />}
            nativeButton={false}
            className="shrink-0"
          >
            {link.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
