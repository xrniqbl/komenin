import { buildSecurityTxt } from "@/lib/scanner-guard";

/**
 * Legacy alias: some scanners and reporters request /security.txt directly
 * instead of /.well-known/security.txt. Same body, same contact resolution.
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
