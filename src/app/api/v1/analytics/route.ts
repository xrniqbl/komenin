import { NextRequest, NextResponse } from "next/server";
import { authenticateApiKey, requireScope } from "@/lib/api-auth";
import { consumeRateLimit, getRequestRateKey } from "@/lib/rate-limit";
import { db } from "@/lib/db";

function currentPeriodKey(): string {
  return `${new Date().getUTCFullYear()}-${String(new Date().getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function GET(req: NextRequest) {
  const rate = consumeRateLimit({
    key: getRequestRateKey(req, 'api:v1:analytics'),
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
  const scopeCheck = requireScope(auth.scopes, "analytics:read");
  if (!scopeCheck.ok) {
    return NextResponse.json({ error: scopeCheck.error }, { status: 403 });
  }

  const periodKey = currentPeriodKey();
  const [sends, failed, approvalsPending, usage, workspace] = await Promise.all([
    db.commentAction.count({ where: { workspaceId: auth.workspaceId, status: "sent" } }),
    db.commentAction.count({ where: { workspaceId: auth.workspaceId, status: "failed" } }),
    db.approval.count({ where: { workspaceId: auth.workspaceId, status: "pending" } }),
    db.usageCounter.findUnique({ where: { workspaceId_periodKey: { workspaceId: auth.workspaceId, periodKey } } }),
    db.workspace.findUnique({ where: { id: auth.workspaceId }, select: { planCode: true, monthlySendLimit: true, monthlyPublishLimit: true } }),
  ]);

  return NextResponse.json({
    data: {
      sends,
      failedSends: failed,
      approvalsPending,
      usage: {
        sends: usage?.sends ?? 0,
        publishes: usage?.publishes ?? 0,
        generates: usage?.generates ?? 0,
        skillRuns: usage?.skillRuns ?? 0,
      },
      limits: workspace,
      periodKey,
    },
  });
}
