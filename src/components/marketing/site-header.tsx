"use client";

import { MenuIcon, XIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { LocaleLink } from "@/components/i18n/locale-link";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";

import { LanguageToggle } from "@/components/i18n/language-toggle";
import { useLocale } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
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

  const featureLinks = [
    { href: "/features/session-routing", label: "Session Routing" },
    { href: "/features/comment-engine", label: "Comment Engine" },
    { href: "/features/agent-intelligence", label: "Agent Intelligence" },
    { href: "/features/skill-execution", label: "Skill Execution" },
  ];

  const platformLinks = [
    { href: "/platform/instagram", label: "Instagram" },
    { href: "/platform/tiktok", label: "TikTok" },
    { href: "/platform/threads", label: "Threads" },
    { href: "/use-cases", label: t.nav.useCases },
    { href: "/integrations", label: t.nav.integrations },
    { href: "/changelog", label: t.nav.changelog },
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
        <LocaleLink href="/" className="inline-flex items-center gap-2">
          <Image src="/brand/komenin-mono.svg" alt="Komenin" width={28} height={28} />
          <span className="text-base font-semibold tracking-tight">Komenin</span>
        </LocaleLink>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
          <Button
            variant="ghost"
            size="sm"
            render={
              <LocaleLink
                href="/features"
                onClick={(event: React.SyntheticEvent) => {
                  if (pathname === "/") {
                    event.preventDefault();
                    goToSection("features");
                  }
                }}
              />
            }
            nativeButton={false}
            className="text-muted-foreground"
          >
            {t.nav.features}
          </Button>
          <NavigationMenu>
            <NavigationMenuList>
              <NavigationMenuItem>
                <NavigationMenuTrigger className="h-8 bg-transparent px-3 text-sm font-normal text-muted-foreground">
                  Platform
                </NavigationMenuTrigger>
                <NavigationMenuContent>
                  <div className="grid w-105 gap-1 p-2">
                    {platformLinks.map((item) => (
                      <NavigationMenuLink
                        key={item.href}
                        render={<LocaleLink href={item.href} />}
                        active={isRouteActive(item.href)}
                      >
                        <span className="text-sm font-medium">{item.label}</span>
                      </NavigationMenuLink>
                    ))}
                  </div>
                </NavigationMenuContent>
              </NavigationMenuItem>
            </NavigationMenuList>
          </NavigationMenu>
          {links
            .filter((link) => !(link.kind === "section" && link.id === "features"))
            .map((link) => {
              // Crawlable-first: Pricing renders as a real link to its
              // indexable page. The scroll-to-section behavior below only
              // intercepts clicks when already on the homepage.
              if (link.kind === "section") {
                const href = "/pricing";
                return (
                  <Button
                    key={link.id}
                    variant="ghost"
                    size="sm"
                    render={
                      <LocaleLink
                        href={href}
                        onClick={(event: React.SyntheticEvent) => {
                          if (pathname === "/") {
                            event.preventDefault();
                            goToSection(link.id);
                          }
                        }}
                      />
                    }
                    nativeButton={false}
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
          <Button variant="ghost" render={<LocaleLink href="/login" />} nativeButton={false}>
            {t.nav.login}
          </Button>
          <Button render={<LocaleLink href="/signup" />} nativeButton={false}>
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
              <div className="px-2 pt-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                {t.nav.features}
              </div>
              {featureLinks.map((item) => (
                <Button
                  key={item.href}
                  variant="ghost"
                  className="justify-start"
                  render={<LocaleLink href={item.href} onClick={() => setMobileOpen(false)} />}
                  nativeButton={false}
                >
                  {item.label}
                </Button>
              ))}
              <div className="px-2 pt-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Platform
              </div>
              {platformLinks.map((item) => (
                <Button
                  key={item.href}
                  variant="ghost"
                  className="justify-start"
                  render={<LocaleLink href={item.href} onClick={() => setMobileOpen(false)} />}
                  nativeButton={false}
                >
                  {item.label}
                </Button>
              ))}
              <div className="px-2 pt-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Company
              </div>
              {links.map((link) => {
                if (link.kind === "section") {
                  const href = link.id === "features" ? "/features" : "/pricing";
                  return (
                    <Button
                      key={link.id}
                      variant="ghost"
                      className="justify-start"
                      render={
                        <LocaleLink
                          href={href}
                          onClick={(event: React.SyntheticEvent) => {
                            setMobileOpen(false);
                            if (pathname === "/") {
                              event.preventDefault();
                              goToSection(link.id);
                            } else {
                              rememberSection(link.id);
                            }
                          }}
                        />
                      }
                      nativeButton={false}
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
                render={<LocaleLink href="/login" />}
                nativeButton={false}
                onClick={() => setMobileOpen(false)}
              >
                {t.nav.login}
              </Button>
              <Button
                className="w-full"
                render={<LocaleLink href="/signup" />}
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
