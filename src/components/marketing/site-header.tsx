"use client";

import MenuIcon from '@mui/icons-material/MenuRounded';
import CloseIcon from '@mui/icons-material/CloseRounded';
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
  const { t, locale } = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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
    if (pathname === "/" || pathname === "/id") {
      scrollToSection(id, "smooth");
      return;
    }
    rememberSection(id);
    router.push(locale === "id" ? "/id" : "/");
  }

  function isRouteActive(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  const headerSolid = scrolled || mobileOpen;

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-40 transition-all duration-300",
        headerSolid
          ? "border-b border-white/10 bg-[#0A0F1E]/90 shadow-lg shadow-black/20 backdrop-blur-xl"
          : "border-b border-transparent bg-transparent",
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 md:px-6">
        <LocaleLink href="/" className="inline-flex items-center gap-2">
          <Image src="/brand/komenin-robot-white.png" alt="Komenin" width={40} height={40} />
          <span className="text-base font-semibold tracking-tight text-white">Komenin</span>
        </LocaleLink>

        <nav
          className={cn(
            "hidden items-center gap-1 rounded-full border px-2 py-1.5 backdrop-blur-xl transition-all duration-300 md:flex",
            scrolled
              ? "border-white/15 bg-[#0A0F1E]/95 shadow-lg shadow-black/30"
              : "border-white/10 bg-white/5",
          )}
          aria-label="Primary"
        >
          <Button
            variant="ghost"
            size="sm"
            render={
              <LocaleLink
                href="/features"
                onClick={(event: React.SyntheticEvent) => {
                  if (pathname === "/" || pathname === "/id") {
                    event.preventDefault();
                    goToSection("features");
                  }
                }}
              />
            }
            nativeButton={false}
            className="rounded-full text-neutral-400 hover:bg-white/10 hover:text-white"
          >
            {t.nav.features}
          </Button>
          <NavigationMenu>
            <NavigationMenuList>
              <NavigationMenuItem>
                <NavigationMenuTrigger className="h-8 rounded-full bg-transparent px-3 text-sm font-normal text-neutral-400 hover:bg-white/10 hover:text-white data-popup-open:bg-white/10 data-popup-open:text-white">
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
          <Button
            variant="ghost"
            size="sm"
            render={
              <LocaleLink
                href="/pricing"
                onClick={(event: React.SyntheticEvent) => {
                  if (pathname === "/" || pathname === "/id") {
                    event.preventDefault();
                    goToSection("pricing");
                  }
                }}
              />
            }
            nativeButton={false}
            className="rounded-full text-neutral-400 hover:bg-white/10 hover:text-white"
          >
            {t.nav.pricing}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            render={<Link href="/enterprise" />}
            nativeButton={false}
            className="rounded-full text-neutral-400 hover:bg-white/10 hover:text-white"
          >
            {t.nav.enterprise}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            render={<Link href="/security" />}
            nativeButton={false}
            className="rounded-full text-neutral-400 hover:bg-white/10 hover:text-white"
          >
            {t.nav.security}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            render={<Link href="/docs" />}
            nativeButton={false}
            className="rounded-full text-neutral-400 hover:bg-white/10 hover:text-white"
          >
            {t.nav.docs}
          </Button>
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <LanguageToggle />
          <Button
            variant="glass"
            render={<LocaleLink href="/signup" />}
            nativeButton={false}
            className="rounded-full text-white"
          >
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
            {mobileOpen ? <CloseIcon className="size-4" /> : <MenuIcon className="size-4" />}
          </Button>
        </div>
      </div>

      {mobileOpen ? (
        <div className="border-t border-white/10 bg-[#0A0F1E]/95 backdrop-blur-xl md:hidden">
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
                            if (pathname === "/" || pathname === "/id") {
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
                variant="glass"
                className="w-full text-white"
                render={<LocaleLink href="/login" />}
                nativeButton={false}
                onClick={() => setMobileOpen(false)}
              >
                {t.nav.login}
              </Button>
              <Button
                variant="electric"
                className="w-full rounded-full"
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
