import { NextResponse } from "next/server";
import { getPublicStatus } from "@/server/status";
import { evaluateProductionGate } from "@/lib/production-gate";
import { isProductionRuntime } from "@/lib/security";
import { consumeRateLimit, getRequestRateKey } from "@/lib/rate-limit";

export async function GET(request: Request) {
  const rate = consumeRateLimit({
    key: getRequestRateKey(request, "api:status"),
    limit: 60,
    windowMs: 60_000,
  });
  if (!rate.ok) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1000))),
        },
      },
    );
  }

  try {
    const data = await getPublicStatus();
    // Gate is evaluated for overall health, but details stay private.
    const gateOk = isProductionRuntime() ? evaluateProductionGate().ok : true;
    return NextResponse.json({
      ok:
        data.incidents.length === 0 &&
        data.uptime.overall >= 95 &&
        gateOk,
      checkedAt: data.checkedAt,
      uptime: data.uptime,
      services: data.services.map((s) => ({
        name: s.name,
        status: s.status,
        uptime: (s as { uptime?: number }).uptime ?? null,
      })),
      counts: data.counts,
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
