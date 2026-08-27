import { cookies, headers } from "next/headers";
import { LOCALE_COOKIE, normalizeLocale } from "@/lib/i18n/locale";
import type { Locale } from "@/lib/i18n/messages";

/**
 * Server-only locale resolution, in priority order:
 * 1. `x-komenin-locale` request header — set by middleware when the URL path
 *    carries the `/id` prefix (path-based locale, indexable by search engines)
 * 2. `komenin.locale` cookie — set by the language toggle (cookie-based
 *    switching within the same URL)
 */
export async function getRequestLocale(): Promise<Locale> {
  try {
    const headerLocale = (await headers()).get("x-komenin-locale");
    if (headerLocale) return normalizeLocale(headerLocale);
  } catch {
    // headers() unavailable in this context — fall through to cookie
  }

  const jar = await cookies();
  return normalizeLocale(jar.get(LOCALE_COOKIE)?.value);
}
