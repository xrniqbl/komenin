import { cookies } from "next/headers";
import type { Locale } from "@/lib/i18n/messages";

export const LOCALE_COOKIE = "aether.locale";
export const LOCALE_STORAGE_KEY = "aether.locale";

export function normalizeLocale(value?: string | null): Locale {
  return value === "id" ? "id" : "en";
}

export async function getRequestLocale(): Promise<Locale> {
  const jar = await cookies();
  return normalizeLocale(jar.get(LOCALE_COOKIE)?.value);
}
