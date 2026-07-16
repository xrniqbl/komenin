"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";

const topLinks = [
  { href: "/docs", label: "Home", match: "home" },
  { href: "/docs/tutorial/introduction", label: "Tutorial", match: "tutorial" },
  { href: "/docs/api", label: "API Reference", match: "api" },
] as const;

export function DocsTopNav() {
  const pathname = usePathname() || "";

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
          Aether Documentation
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
          <Button
            size="sm"
            variant="ghost"
            className="ml-2"
            render={<Link href="/" />}
            nativeButton={false}
          >
            Back to site
          </Button>
        </nav>
      </div>
    </div>
  );
}
