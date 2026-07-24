"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LanguageToggle } from "@/components/i18n/language-toggle";
import { useLocale } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";

export function DocsTopNav() {
  const pathname = usePathname() || "";
  const { t } = useLocale();
  const ui = t.docsUi;

  const topLinks = [
    { href: "/docs", label: ui.home, match: "home" },
    { href: "/docs/tutorial/introduction", label: ui.tutorial, match: "tutorial" },
    { href: "/docs/api", label: ui.api, match: "api" },
  ] as const;

  function isActive(match: string) {
    if (match === "home") return pathname === "/docs";
    if (match === "tutorial") return pathname.startsWith("/docs/tutorial");
    if (match === "api") return pathname.startsWith("/docs/api");
    return false;
  }

  return (
    <div className="border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 md:px-6">
        <Link href="/docs" className="text-sm font-semibold tracking-tight">
          {ui.brand}
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          {topLinks.map((link) => {
            const active = isActive(link.match);
            return (
              <Button
                key={link.href}
                size="sm"
                variant={active ? "secondary" : "ghost"}
                render={<Link href={link.href} />}
                nativeButton={false}
              >
                {link.label}
              </Button>
            );
          })}
          <LanguageToggle className="ml-2 hidden sm:inline-flex" />
          <Button
            size="sm"
            variant="ghost"
            className="ml-1"
            render={<Link href="/" />}
            nativeButton={false}
          >
            {ui.backToSite}
          </Button>
        </nav>
      </div>
    </div>
  );
}
