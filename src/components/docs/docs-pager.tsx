"use client";

import Link from "next/link";
import type { DocsNavItem } from "@/data/docs";
import { useLocale } from "@/components/i18n/locale-provider";
import { Card, CardContent } from "@/components/ui/card";

export function DocsPager({
  prev,
  next,
}: {
  prev: DocsNavItem | null;
  next: DocsNavItem | null;
}) {
  const { t } = useLocale();
  if (!prev && !next) return null;

  return (
    <div className="mt-12 grid gap-3 border-t border-white/10 pt-6 sm:grid-cols-2">
      {prev ? (
        <Link href={prev.href} className="block">
          <Card className="h-full transition-colors hover:border-electric-500/30">
            <CardContent className="p-4">
              <div className="text-xs text-neutral-500">{t.docsUi.previous}</div>
              <div className="mt-1 text-sm font-medium text-white">{prev.title}</div>
            </CardContent>
          </Card>
        </Link>
      ) : (
        <div />
      )}
      {next ? (
        <Link href={next.href} className="block">
          <Card className="h-full transition-colors hover:border-electric-500/30">
            <CardContent className="p-4 text-right">
              <div className="text-xs text-neutral-500">{t.docsUi.next}</div>
              <div className="mt-1 text-sm font-medium text-white">{next.title}</div>
            </CardContent>
          </Card>
        </Link>
      ) : null}
    </div>
  );
}
