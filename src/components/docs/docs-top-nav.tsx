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
    <div className="sticky top-0 z-40 border-b border-white/10 bg-[#0A0F1E]/80 shadow-lg shadow-black/20 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4 md:px-6">
        <Link href="/docs" className="shrink-0 text-sm font-semibold tracking-tight text-white">
          {ui.brand}
        </Link>
        <nav
          className="flex min-w-0 items-center gap-1 overflow-x-auto rounded-full border border-white/10 bg-white/5 px-2 py-1 backdrop-blur-xl"
          aria-label="Docs"
        >
          {topLinks.map((link) => {
            const active = isActive(link.match);
            return (
              <Button
                key={link.href}
                size="sm"
                variant="ghost"
                render={<Link href={link.href} />}
                nativeButton={false}
                className={
                  active
                    ? "rounded-full bg-white font-medium text-neutral-950 hover:bg-white hover:text-neutral-950"
                    : "rounded-full font-normal text-neutral-400 hover:bg-white/10 hover:text-white"
                }
                aria-current={active ? "page" : undefined}
              >
                {link.label}
              </Button>
            );
          })}
          <LanguageToggle className="ml-1 hidden sm:inline-flex" />
          <Button
            size="sm"
            variant="glass"
            className="ml-1 rounded-full border-white/30 bg-transparent text-white hover:border-white/60 hover:bg-white/5 hover:text-white"
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
