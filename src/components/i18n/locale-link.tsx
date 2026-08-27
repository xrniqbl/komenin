"use client";

import Link from "next/link";
import { useLocale } from "@/components/i18n/locale-provider";
import { withLocalePath } from "@/lib/i18n/paths";
import type { ComponentProps } from "react";

/**
 * Locale-aware internal link: prefixes public paths with /id when the
 * Indonesian locale is active. Private paths (/app, /api, /admin, …) and
 * in-page anchors pass through untouched.
 */
export function LocaleLink({ href, ...rest }: ComponentProps<typeof Link>) {
  const { locale } = useLocale();
  const target =
    typeof href === "string" ? withLocalePath(locale, href) : href;
  return <Link href={target} {...rest} />;
}
