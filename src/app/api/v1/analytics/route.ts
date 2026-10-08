import { NextRequest, NextResponse } from "next/server";
import { authenticateApiKey, requireScope } from "@/lib/api-auth";
import { apiError } from "@/lib/api-errors";
import { consumeRateLimit, getRequestRateKey } from "@/lib/rate-limit";
import { db } from "@/lib/db";

function currentPeriodKey(): string {
  return `${new Date().getUTCFullYear()}-${String(new Date().getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function GET(req: NextRequest) {
  const rate = await consumeRateLimit({
    key: getRequestRateKey(req, 'api:v1:analytics'),
    limit: 60,
    windowMs: 60_000,
  });
  if (!rate.ok) {
    return apiError("RATE_LIMITED", 429, undefined, {
      headers: {
        'Retry-After': String(Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1000))),
        'X-RateLimit-Limit': String(rate.limit),
        'X-RateLimit-Remaining': '0',
      },
    });
  }
  const auth = await authenticateApiKey(req);
  if (!auth) {
    return apiError("UNAUTHORIZED", 401);
  }
  const scopeCheck = requireScope(auth.scopes, "analytics:read");
  if (!scopeCheck.ok) {
    return apiError("SCOPE_REQUIRED", 403, scopeCheck.error);
  }

  const periodKey = currentPeriodKey();
  let sends: number, failed: number, approvalsPending: number;
  let usage: {
    sends: number;
    publishes: number;
    generates: number;
    skillRuns: number;
  } | null;
  let workspace: {
    planCode: string;
    monthlySendLimit: number;
    monthlyPublishLimit: number;
  } | null;
  try {
    [sends, failed, approvalsPending, usage, workspace] = await Promise.all([
      db.commentAction.count({ where: { workspaceId: auth.workspaceId, status: "sent" } }),
      db.commentAction.count({ where: { workspaceId: auth.workspaceId, status: "failed" } }),
      db.approval.count({ where: { workspaceId: auth.workspaceId, status: "pending" } }),
      db.usageCounter.findUnique({ where: { workspaceId_periodKey: { workspaceId: auth.workspaceId, periodKey } } }),
      db.workspace.findUnique({ where: { id: auth.workspaceId }, select: { planCode: true, monthlySendLimit: true, monthlyPublishLimit: true } }),
    ]);
  } catch {
    return apiError("SERVICE_UNAVAILABLE", 503);
  }

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
