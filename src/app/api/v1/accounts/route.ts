import { NextRequest, NextResponse } from "next/server";
import { authenticateApiKey, requireScope } from "@/lib/api-auth";
import { consumeRateLimit, getRequestRateKey } from "@/lib/rate-limit";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const rate = consumeRateLimit({
    key: getRequestRateKey(req, 'api:v1:accounts'),
    limit: 60,
    windowMs: 60_000,
  });
  if (!rate.ok) {
    return NextResponse.json(
      { error: 'Rate limit exceeded' },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1000))),
          'X-RateLimit-Limit': String(rate.limit),
          'X-RateLimit-Remaining': '0',
        },
      },
    );
  }
  const auth = await authenticateApiKey(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const scopeCheck = requireScope(auth.scopes, "accounts:read");
  if (!scopeCheck.ok) {
    return NextResponse.json({ error: scopeCheck.error }, { status: 403 });
  }

  const accounts = await db.socialAccount.findMany({
    where: { workspaceId: auth.workspaceId, deletedAt: null },
    select: {
      id: true,
      platform: true,
      username: true,
      displayName: true,
      status: true,
      healthScore: true,
      currentIp: true,
      dailyQuota: true,
      actionsToday: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ data: accounts, meta: { count: accounts.length } });
}
