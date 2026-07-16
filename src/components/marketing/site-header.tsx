"use client";

import { MenuIcon, XIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";

import { LanguageToggle } from "@/components/i18n/language-toggle";
import { useLocale } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { rememberSection, scrollToSection } from "@/lib/scroll-section";
import { cn } from "@/lib/utils";

type NavItem =
  | { kind: "section"; id: "features" | "pricing"; label: string }
  | { kind: "route"; href: string; label: string };

export function SiteHeader() {
  const { t } = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const links: NavItem[] = [
    { kind: "section", id: "features", label: t.nav.features },
    { kind: "section", id: "pricing", label: t.nav.pricing },
    { kind: "route", href: "/enterprise", label: t.nav.enterprise },
    { kind: "route", href: "/security", label: t.nav.security },
    { kind: "route", href: "/docs", label: t.nav.docs },
  ];

  function goToSection(id: "features" | "pricing") {
    if (pathname === "/") {
      scrollToSection(id, "smooth");
      return;
    }
    rememberSection(id);
    router.push("/");
  }

  function isRouteActive(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 md:px-6">
        <Link href="/" className="inline-flex items-center gap-2">
          <Image src="/brand/aether-mono.svg" alt="Aether" width={28} height={28} priority />
          <span className="text-base font-semibold tracking-tight">Aether</span>
        </Link>

        <nav className="hidden items-center gap-2 md:flex" aria-label="Primary">
          {links.map((link) => {
            if (link.kind === "section") {
              return (
                <Button
                  key={link.id}
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => goToSection(link.id)}
                  className="text-muted-foreground"
                >
                  {link.label}
                </Button>
              );
            }

            const active = isRouteActive(link.href);
            return (
              <Button
                key={link.href}
                variant="ghost"
                size="sm"
                render={<Link href={link.href} aria-current={active ? "page" : undefined} />}
                nativeButton={false}
                className={cn(active ? "text-foreground" : "text-muted-foreground")}
              >
                {link.label}
              </Button>
            );
          })}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <LanguageToggle />
          <Button variant="ghost" render={<Link href="/login" />} nativeButton={false}>
            {t.nav.login}
          </Button>
          <Button render={<Link href="/signup" />} nativeButton={false}>
            {t.nav.startFree}
          </Button>
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <LanguageToggle />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t.nav.openMenu}
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
            onClick={() => setMobileOpen((open) => !open)}
          >
            {mobileOpen ? <XIcon className="size-4" /> : <MenuIcon className="size-4" />}
          </Button>
        </div>
      </div>

      {mobileOpen ? (
        <div className="border-t bg-background md:hidden">
          <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 md:px-6">
            <nav id="mobile-nav" className="flex flex-col gap-1" aria-label="Mobile">
              {links.map((link) => {
                if (link.kind === "section") {
                  return (
                    <Button
                      key={link.id}
                      type="button"
                      variant="ghost"
                      className="justify-start"
                      onClick={() => {
                        setMobileOpen(false);
                        goToSection(link.id);
                      }}
                    >
                      {link.label}
                    </Button>
                  );
                }

                const active = isRouteActive(link.href);
                return (
                  <Button
                    key={link.href}
                    variant="ghost"
                    className={cn("justify-start", active && "bg-accent")}
                    render={
                      <Link
                        href={link.href}
                        aria-current={active ? "page" : undefined}
                        onClick={() => setMobileOpen(false)}
                      />
                    }
                    nativeButton={false}
                  >
                    {link.label}
                  </Button>
                );
              })}
            </nav>
            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                className="w-full"
                render={<Link href="/login" />}
                nativeButton={false}
                onClick={() => setMobileOpen(false)}
              >
                {t.nav.login}
              </Button>
              <Button
                className="w-full"
                render={<Link href="/signup" />}
                nativeButton={false}
                onClick={() => setMobileOpen(false)}
              >
                {t.nav.startFree}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
