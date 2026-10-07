"use client";

import { useLocale } from "@/components/i18n/locale-provider";
import { cn } from "@/lib/utils";
import { alternateLocalePath } from "@/lib/i18n/paths";
import type { Locale } from "@/lib/i18n/messages";

export function LanguageToggle({ className }: { className?: string }) {
  const pathname = typeof window !== "undefined" ? window.location.pathname : "/";
  const { locale, setLocale, t } = useLocale();

  return (
    <div
      className={cn(
        "glass inline-flex items-center rounded-full border-white/10 p-1",
        className,
      )}
      role="group"
      aria-label={t.nav.language}
    >
      {(["en", "id"] as Locale[]).map((code) => {
        const active = locale === code;
        const href = alternateLocalePath(pathname, code);
        return (
          <a
            key={code}
            href={href}
            onClick={() => {
              setLocale(code);
            }}
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-medium touch-manipulation",
              active
                ? "bg-electric-500 text-white"
                : "text-neutral-400 hover:text-white",
            )}
            aria-pressed={active}
          >
            {code.toUpperCase()}
          </a>
        );
      })}
    </div>
  );
}
