import { NextRequest, NextResponse } from "next/server";
import { authenticateApiKey, requireScope } from "@/lib/api-auth";
import { apiError } from "@/lib/api-errors";
import { consumeRateLimit, getRequestRateKey } from "@/lib/rate-limit";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const rate = await consumeRateLimit({
    key: getRequestRateKey(req, 'api:v1:activity'),
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
  const scopeCheck = requireScope(auth.scopes, "activity:read");
  if (!scopeCheck.ok) {
    return apiError("SCOPE_REQUIRED", 403, scopeCheck.error);
  }

  let actions;
  try {
    actions = await db.commentAction.findMany({
      where: { workspaceId: auth.workspaceId },
      include: { targetPost: { select: { authorHandle: true, platform: true } }, socialAccount: { select: { username: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  } catch {
    return apiError("SERVICE_UNAVAILABLE", 503);
  }

  return NextResponse.json({
    data: actions.map((a) => ({
      id: a.id,
      status: a.status,
      resultMessage: a.resultMessage,
      scheduledFor: a.scheduledFor,
      executedAt: a.executedAt,
      targetPost: a.targetPost,
      socialAccount: a.socialAccount,
      createdAt: a.createdAt,
    })),
    meta: { count: actions.length },
  });
}
