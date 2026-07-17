import { NextResponse } from "next/server";
import { getPublicStatus } from "@/server/status";
import { evaluateProductionGate } from "@/lib/production-gate";
import { isProductionRuntime } from "@/lib/security";

export async function GET() {
  try {
    const data = await getPublicStatus();
    const gate = isProductionRuntime() ? evaluateProductionGate() : null;
    return NextResponse.json({
      ok:
        data.incidents.length === 0 &&
        data.uptime.overall >= 95 &&
        (gate ? gate.ok : true),
      checkedAt: data.checkedAt,
      uptime: data.uptime,
      services: data.services.map((s) => ({
        name: s.name,
        status: s.status,
        uptime: (s as { uptime?: number }).uptime ?? null,
      })),
      counts: data.counts,
      productionGate: gate
        ? {
            ok: gate.ok,
            errors: gate.errors,
            warnings: gate.warnings,
          }
        : undefined,
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "Status check unavailable",
        checkedAt: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}