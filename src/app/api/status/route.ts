import { NextResponse } from "next/server";
import { getPublicStatus } from "@/server/status";

export async function GET() {
  try {
    const data = await getPublicStatus();
    return NextResponse.json({
      ok: data.incidents.length === 0 && data.uptime.overall >= 95,
      checkedAt: data.checkedAt,
      uptime: data.uptime,
      services: data.services.map((s) => ({ name: s.name, status: s.status, uptime: (s as { uptime?: number }).uptime ?? null })),
      counts: data.counts,
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : "Status check failed",
        checkedAt: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}
