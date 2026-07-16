import { NextRequest, NextResponse } from "next/server";
import { authenticateApiKey, requireScope } from "@/lib/api-auth";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const auth = await authenticateApiKey(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const scopeCheck = requireScope(auth.scopes, "activity:read");
  if (!scopeCheck.ok) {
    return NextResponse.json({ error: scopeCheck.error }, { status: 403 });
  }

  const actions = await db.commentAction.findMany({
    where: { workspaceId: auth.workspaceId },
    include: { targetPost: { select: { authorHandle: true, platform: true } }, socialAccount: { select: { username: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

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
