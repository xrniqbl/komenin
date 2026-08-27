import type { Locale } from "@/lib/i18n/messages";

/**
 * Path-based locale addressing for public marketing pages.
 *
 * EN lives at the root (`/pricing`), Indonesian under `/id/…` (`/id/pricing`).
 * The app tree itself is single-copy: middleware rewrites `/id/<path>` to
 * `/<path>` and flags the locale via request header, so no component moves.
 */

export const LOCALE_PATH_PREFIX: Record<Locale, string> = {
  en: "",
  id: "/id",
};

/** Paths that must never receive a locale prefix. */
const NO_PREFIX_PATTERNS = [
  /^\/api(\/|$)/,
  /^\/admin(\/|$)/,
  /^\/app(\/|$)/,
  /^\/_next(\/|$)/,
  /^\/auth(\/|$)/,
  /^\/onboarding$/,
  /^\/invite(\/|$)/,
  /^\/checkout(\/|$)/,
  /^\/sw\.js$/,
  /^\/robots\.txt$/,
  /^\/sitemap\.xml$/,
  /^\/opengraph-image/,
  /^\/twitter-image/,
  /^\/favicon/,
  /^\/brand\//,
  /^\/manifest\.webmanifest$/,
];

/** True when a pathname is a public, prefixable page path. */
export function isPrefixablePath(pathname: string): boolean {
  if (!pathname.startsWith("/")) return false;
  return !NO_PREFIX_PATTERNS.some((pattern) => pattern.test(pathname));
}

/**
 * Split a public pathname into { locale, path } where path is the unprefixed
 * canonical EN route. Non-prefixable paths always resolve to `en` + the
 * original path.
 */
export function splitLocalePath(pathname: string): { locale: Locale; path: string } {
  if (!pathname.startsWith("/id/") && pathname !== "/id") {
    return { locale: "en", path: pathname };
  }
  if (pathname === "/id" || pathname === "/id/") {
    return { locale: "id", path: "/" };
  }
  return { locale: "id", path: pathname.slice("/id".length) };
}

/** Render a public path under a locale (`/pricing` → `/id/pricing`). */
export function withLocalePath(locale: Locale, path: string): string {
  const prefix = LOCALE_PATH_PREFIX[locale];
  if (!prefix) return path;
  if (!isPrefixablePath(path)) return path;
  if (path === "/") return `${prefix}`;
  return `${prefix}${path}`;
}

/** The same page in the other locale (used by the language toggle). */
export function alternateLocalePath(
  pathname: string,
  target: Locale,
): string {
  const { path } = splitLocalePath(pathname);
  return withLocalePath(target, path);
}
