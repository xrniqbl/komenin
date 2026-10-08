import { exportCampaignsCsv, exportClientsCsv, exportSummaryCsv } from "@/server/analytics";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Analytics CSV download. Auth + `analytics.view` permission are enforced
 * inside each exporter via requireActiveWorkspace + assertWorkspacePermission.
 *
 * `?type=summary|clients|campaigns&range=7|30|90` (defaults: summary, 30).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const type = url.searchParams.get("type") || "summary";
  const rangeParam = Number(url.searchParams.get("range"));
  const range = rangeParam === 7 ? 7 : rangeParam === 90 ? 90 : 30;

  const exported =
    type === "clients"
      ? await exportClientsCsv(range)
      : type === "campaigns"
        ? await exportCampaignsCsv(range)
        : await exportSummaryCsv(range);

  return new Response(exported.csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${exported.filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
