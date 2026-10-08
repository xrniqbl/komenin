import { NextRequest, NextResponse } from "next/server";
import { withApiV1 } from "@/lib/api-v1";
import { apiError } from "@/lib/api-errors";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const auth = await withApiV1(req, "api:v1:accounts", "accounts:read");
  if (!auth.ok) return auth.response;

  let accounts;
  try {
    accounts = await db.socialAccount.findMany({
      where: { workspaceId: auth.workspaceId, deletedAt: null },
      select: {
        id: true,
        platform: true,
        username: true,
        displayName: true,
        status: true,
        healthScore: true,
        // currentIp deliberately excluded: proxy IPs are sensitive
        // infrastructure data, not part of a read-only integration surface.
        dailyQuota: true,
        actionsToday: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  } catch {
    return apiError("SERVICE_UNAVAILABLE", 503);
  }

  return NextResponse.json({ data: accounts, meta: { count: accounts.length } });
}
