"use client";

import { MenuIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetHeader,
  SheetPopup,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const links = [
  { href: "/features", label: "Features" },
  { href: "/pricing", label: "Pricing" },
  { href: "/enterprise", label: "Enterprise" },
  { href: "/security", label: "Security" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 md:px-6">
        <Link href="/" className="text-base font-semibold tracking-tight">
          Aether
        </Link>

        <nav className="hidden items-center gap-6 md:flex" aria-label="Primary">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Button variant="ghost" render={<Link href="/login" />} nativeButton={false}>
            Log in
          </Button>
          <Button render={<Link href="/signup" />} nativeButton={false}>
            Start free
          </Button>
        </div>

        <Sheet>
          <SheetTrigger
            render={
              <Button
                size="icon"
                variant="ghost"
                className="md:hidden"
                aria-label="Open menu"
              />
            }
          >
            <MenuIcon />
          </SheetTrigger>
          <SheetPopup side="right" className="w-[min(100%,20rem)]">
            <SheetHeader className="border-b">
              <SheetTitle>Aether</SheetTitle>
            </SheetHeader>
            <div className="flex flex-1 flex-col gap-6 p-6">
              <nav className="flex flex-col gap-1" aria-label="Mobile">
                {links.map((link) => (
                  <SheetClose
                    key={link.href}
                    className="rounded-lg px-3 py-2 text-left text-sm font-medium text-foreground transition-colors hover:bg-accent"
                    render={<Link href={link.href} />}
                    nativeButton={false}
                  >
                    {link.label}
                  </SheetClose>
                ))}
              </nav>
              <div className="mt-auto flex flex-col gap-2">
                <Button
                  variant="outline"
                  className="w-full"
                  render={<Link href="/login" />}
                  nativeButton={false}
                >
                  Log in
                </Button>
                <Button
                  className="w-full"
                  render={<Link href="/signup" />}
                  nativeButton={false}
                >
                  Start free
                </Button>
              </div>
            </div>
          </SheetPopup>
        </Sheet>
      </div>
    </header>
  );
}