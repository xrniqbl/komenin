import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withApiV1 } from "@/lib/api-v1";
import { apiError } from "@/lib/api-errors";
import { db } from "@/lib/db";
import { writeAuditLog } from "@/server/audit";

const createSchema = z.object({
  platform: z.enum(["instagram", "threads", "tiktok"]),
  type: z.enum(["keyword", "competitor", "trend"]).default("keyword"),
  query: z.string().trim().min(1).max(200),
  campaignId: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
});

export async function GET(req: NextRequest) {
  const auth = await withApiV1(req, "api:v1:listeners", "listeners:read");
  if (!auth.ok) return auth.response;

  let listeners;
  try {
    listeners = await db.listener.findMany({
      where: { workspaceId: auth.workspaceId },
      include: {
        campaign: { select: { id: true, name: true } },
        _count: { select: { posts: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  } catch {
    return apiError("SERVICE_UNAVAILABLE", 503);
  }

  return NextResponse.json({
    data: listeners.map((l) => ({
      id: l.id,
      platform: l.platform,
      type: l.type,
      query: l.query,
      isActive: l.isActive,
      campaignId: l.campaignId,
      campaignName: l.campaign?.name || null,
      posts: l._count.posts,
      createdAt: l.createdAt,
    })),
    meta: { count: listeners.length, workspaceId: auth.workspaceId, keyId: auth.keyId },
  });
}

export async function POST(req: NextRequest) {
  const auth = await withApiV1(req, "api:v1:listeners:write", "listeners:write", {
    write: true,
  });
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("INVALID_JSON", 400);
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      "INVALID_INPUT",
      400,
      parsed.error.issues[0]?.message || "Invalid payload",
    );
  }

  const input = parsed.data;
  let campaignExists = true;
  if (input.campaignId) {
    try {
      const campaign = await db.campaign.findFirst({
        where: { id: input.campaignId, workspaceId: auth.workspaceId },
        select: { id: true },
      });
      campaignExists = !!campaign;
    } catch {
      return apiError("SERVICE_UNAVAILABLE", 503);
    }
    if (!campaignExists) {
      return apiError("NOT_FOUND", 404, "Campaign not found");
    }
  }

  let listener;
  try {
    listener = await db.listener.create({
      data: {
        workspaceId: auth.workspaceId,
        platform: input.platform,
        type: input.type,
        query: input.query,
        campaignId: input.campaignId || null,
        isActive: input.isActive ?? true,
      },
    });
  } catch {
    return apiError("SERVICE_UNAVAILABLE", 503);
  }

  await writeAuditLog({
    workspaceId: auth.workspaceId,
    action: "api.listener.created",
    resourceType: "listener",
    resourceId: listener.id,
    metadata: {
      query: listener.query,
      platform: listener.platform,
      keyId: auth.keyId,
    },
  });

  return NextResponse.json(
    {
      data: {
        id: listener.id,
        platform: listener.platform,
        type: listener.type,
        query: listener.query,
        isActive: listener.isActive,
        campaignId: listener.campaignId,
        createdAt: listener.createdAt,
      },
    },
    { status: 201 },
  );
}
