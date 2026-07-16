"use client";

import { useLocale } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Locale } from "@/lib/i18n/messages";

export function LanguageToggle({ className }: { className?: string }) {
  const { locale, setLocale, t } = useLocale();

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border border-neutral-200 bg-white p-1",
        className,
      )}
      role="group"
      aria-label={t.nav.language}
    >
      {(["en", "id"] as Locale[]).map((code) => {
        const active = locale === code;
        return (
          <Button
            key={code}
            type="button"
            size="xs"
            variant={active ? "default" : "ghost"}
            onClick={() => setLocale(code)}
            className={cn(
              "rounded-full px-2.5",
              !active && "text-neutral-600 hover:text-neutral-900",
            )}
            aria-pressed={active}
          >
            {code.toUpperCase()}
          </Button>
        );
      })}
    </div>
  );
}
