"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DocsSearch } from "@/components/docs/docs-search";
import { useLocale } from "@/components/i18n/locale-provider";
import { getDocsNav } from "@/data/docs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export function DocsSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { locale, t } = useLocale();
  const nav = getDocsNav(locale);

  return (
    <ScrollArea className="h-full">
      <div className="px-4 py-6">
        <div className="mb-4 text-sm font-semibold tracking-tight">{t.docsUi.brandShort}</div>
        <DocsSearch />
        <nav className="space-y-5">
          {nav.map((group) => (
            <div key={group.title}>
              <div className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {group.title}
              </div>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const active =
                    pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onNavigate}
                      className={cn(
                        "block rounded-md px-2.5 py-1.5 text-sm transition-colors",
                        active
                          ? "bg-accent font-medium text-foreground"
                          : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                      )}
                    >
                      {item.title}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>
    </ScrollArea>
  );
}
