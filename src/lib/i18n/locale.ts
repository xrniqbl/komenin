import type { Locale } from "@/lib/i18n/messages";

/** Cookie + storage keys shared by server and client locale code. */
export const LOCALE_COOKIE = "komenin.locale";
export const LOCALE_STORAGE_KEY = "komenin.locale";

export function normalizeLocale(value?: string | null): Locale {
  return value === "id" ? "id" : "en";
}
