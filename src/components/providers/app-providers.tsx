"use client";

import { LocaleProvider } from "@/components/i18n/locale-provider";
import { ToastProvider } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { Locale } from "@/lib/i18n/messages";

export function AppProviders({
  children,
  initialLocale = "en",
}: {
  children: React.ReactNode;
  initialLocale?: Locale;
}) {
  return (
    <LocaleProvider initialLocale={initialLocale}>
      <TooltipProvider delay={200}>
        <ToastProvider position="bottom-right">{children}</ToastProvider>
      </TooltipProvider>
    </LocaleProvider>
  );
}
