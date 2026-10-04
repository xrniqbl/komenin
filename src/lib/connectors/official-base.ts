import {
  assertSafeOutboundUrl,
} from "@/lib/url-safety";

const OFFICIAL_API_BASE_ALLOWLIST = [
  "graph.facebook.com",
  "graph.threads.net",
  "graph.instagram.com",
  "open.tiktokapis.com",
  "open-api.tiktok.com",
  "business-api.tiktok.com",
] as const;

/**
 * Official API base hosts are pinned — no .local/.internal carve-outs.
 *
 * Lives in lib (not in a "use server" module) because "use server" files may
 * only export async functions — a sync export breaks the production build
 * (Turbopack: "Server Actions must be async functions").
 */
export function isAllowedOfficialApiBaseUrl(raw: string): boolean {
  let host = "";
  try {
    host = assertSafeOutboundUrl(raw).hostname.toLowerCase();
  } catch {
    return false;
  }
  return OFFICIAL_API_BASE_ALLOWLIST.some(
    (allowed) => host === allowed || host.endsWith(`.${allowed}`),
  );
}
