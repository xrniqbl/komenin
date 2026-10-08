import { exportAuditLogsCsv } from "@/server/audit-export";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Audit-log CSV download (max 2000 rows). Auth + permission are enforced
 * inside exportAuditLogsCsv via requireActiveWorkspace + audit.export grant.
 */
export async function GET() {
  const exported = await exportAuditLogsCsv(2000);
  return new Response(exported.csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${exported.filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
