import { cookies } from "next/headers";
import { LOCALE_COOKIE, normalizeLocale } from "@/lib/i18n/locale";
import type { Locale } from "@/lib/i18n/messages";

/** Server-only: read the locale cookie for RSC / layout. */
export async function getRequestLocale(): Promise<Locale> {
  const jar = await cookies();
  return normalizeLocale(jar.get(LOCALE_COOKIE)?.value);
}
