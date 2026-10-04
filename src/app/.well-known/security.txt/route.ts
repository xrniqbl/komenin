import { buildSecurityTxt } from "@/lib/scanner-guard";

/**
 * security.txt (RFC 9116) — contact point for white-hat reporters.
 * Served at /.well-known/security.txt as `text/plain`. Contact resolves
 * from SECURITY_CONTACT, else SUPPORT_INBOX_EMAIL, else the default inbox.
 */
export const dynamic = "force-dynamic";

export function GET(): Response {
  return new Response(buildSecurityTxt(), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=86400",
    },
  });
}
