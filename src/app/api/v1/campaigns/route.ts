import { NextRequest, NextResponse } from "next/server";
import { authenticateApiKey, requireScope } from "@/lib/api-auth";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const auth = await authenticateApiKey(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized — provide x-api-key or Authorization: Bearer aeth_..." }, { status: 401 });
  }

  const scopeCheck = requireScope(auth.scopes, "campaigns:read");
  if (!scopeCheck.ok) {
    return NextResponse.json({ error: scopeCheck.error }, { status: 403 });
  }

  const campaigns = await db.campaign.findMany({
    where: { workspaceId: auth.workspaceId },
    include: {
      _count: { select: { targetPosts: true, drafts: true, approvals: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({
    data: campaigns.map((c) => ({
      id: c.id,
      name: c.name,
      platform: c.platform,
      status: c.status,
      mode: c.mode,
      goal: c.goal,
      dailyLimit: c.dailyLimit,
      createdAt: c.createdAt,
      targetPosts: c._count.targetPosts,
      drafts: c._count.drafts,
      approvals: c._count.approvals,
    })),
    meta: { count: campaigns.length, workspaceId: auth.workspaceId, keyId: auth.keyId },
  });
}
