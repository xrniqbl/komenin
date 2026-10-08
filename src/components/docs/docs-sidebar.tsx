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
        <div className="mb-4 text-sm font-semibold tracking-tight text-white">{t.docsUi.brandShort}</div>
        <DocsSearch />
        <nav className="space-y-5">
          {nav.map((group) => (
            <div key={group.title}>
              <div className="mb-2 text-xs font-semibold tracking-widest text-neutral-500 uppercase">
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
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "block rounded-lg border px-2.5 py-1.5 text-sm transition-colors",
                        active
                          ? "border-electric-500/30 bg-electric-500/10 font-medium text-white"
                          : "border-transparent text-neutral-400 hover:border-white/10 hover:bg-white/5 hover:text-white",
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
