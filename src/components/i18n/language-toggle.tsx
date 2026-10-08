"use client";

import { usePathname, useRouter } from "next/navigation";
import { useLocale } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { alternateLocalePath } from "@/lib/i18n/paths";
import type { Locale } from "@/lib/i18n/messages";

export function LanguageToggle({
  className,
  tone = "dark",
}: {
  className?: string;
  tone?: "dark" | "light";
}) {
  const router = useRouter();
  const pathname = usePathname() || "/";
  const { locale, setLocale, t } = useLocale();
  const isDark = tone === "dark";

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border p-1",
        isDark
          ? "border-white/10 bg-white/5 backdrop-blur-xl"
          : "border-neutral-200 bg-white",
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
            variant={isDark ? "ghost" : active ? "default" : "ghost"}
            onClick={() => {
              // Keep the cookie in sync for client components and the
              // fallback locale resolution, then move to the localized URL.
              setLocale(code);
              if (code !== locale) {
                router.push(alternateLocalePath(pathname, code));
              } else {
                router.refresh();
              }
            }}
            className={cn(
              "rounded-full px-2.5",
              isDark
                ? active
                  ? "bg-white font-semibold text-neutral-950 shadow-sm hover:bg-white hover:text-neutral-950"
                  : "font-normal text-neutral-400 hover:bg-white/10 hover:text-white"
                : !active && "text-neutral-600 hover:text-neutral-900",
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
