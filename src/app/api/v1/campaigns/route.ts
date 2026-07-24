import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withApiV1 } from "@/lib/api-v1";
import { db } from "@/lib/db";
import { writeAuditLog } from "@/server/audit";

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  platform: z.enum(["instagram", "threads", "tiktok"]),
  mode: z.enum(["draft", "approval_required", "auto"]).optional(),
  goal: z.string().trim().max(500).optional(),
  dailyLimit: z.number().int().min(1).max(500).optional(),
  minDelaySec: z.number().int().min(5).max(3600).optional(),
  maxDelaySec: z.number().int().min(10).max(7200).optional(),
  socialAccountIds: z.array(z.string().min(1)).max(50).optional(),
  listenerQuery: z.string().trim().max(200).optional(),
  clientId: z.string().min(1).optional(),
  status: z.enum(["draft", "active", "paused"]).optional(),
});

export async function GET(req: NextRequest) {
  const auth = await withApiV1(req, "api:v1:campaigns", "campaigns:read");
  if (!auth.ok) return auth.response;

  const campaigns = await db.campaign.findMany({
    where: { workspaceId: auth.workspaceId },
    include: {
      client: { select: { id: true, name: true, slug: true } },
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
      clientId: c.clientId,
      client: c.client,
      createdAt: c.createdAt,
      targetPosts: c._count.targetPosts,
      drafts: c._count.drafts,
      approvals: c._count.approvals,
    })),
    meta: { count: campaigns.length, workspaceId: auth.workspaceId, keyId: auth.keyId },
  });
}

export async function POST(req: NextRequest) {
  const auth = await withApiV1(req, "api:v1:campaigns:write", "campaigns:write", {
    write: true,
  });
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid payload" },
      { status: 400 },
    );
  }

  const input = parsed.data;
  if (
    input.minDelaySec != null &&
    input.maxDelaySec != null &&
    input.minDelaySec > input.maxDelaySec
  ) {
    return NextResponse.json(
      { error: "minDelaySec must be <= maxDelaySec" },
      { status: 400 },
    );
  }

  if (input.socialAccountIds?.length) {
    const count = await db.socialAccount.count({
      where: {
        workspaceId: auth.workspaceId,
        deletedAt: null,
        id: { in: input.socialAccountIds },
      },
    });
    if (count !== input.socialAccountIds.length) {
      return NextResponse.json(
        { error: "One or more socialAccountIds are invalid for this workspace" },
        { status: 400 },
      );
    }
  }

  let clientId: string | null = null;
  if (input.clientId) {
    const client = await db.clientProfile.findFirst({
      where: { id: input.clientId, workspaceId: auth.workspaceId, isActive: true },
      select: { id: true },
    });
    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 400 });
    }
    clientId = client.id;
  }

  const defaultAgent = await db.agent.findFirst({
    where: { workspaceId: auth.workspaceId },
    orderBy: { createdAt: "asc" },
  });

  const campaign = await db.$transaction(async (tx) => {
    const created = await tx.campaign.create({
      data: {
        workspaceId: auth.workspaceId,
        name: input.name,
        platform: input.platform,
        mode: input.mode || "approval_required",
        status: input.status || "active",
        agentId: defaultAgent?.id || null,
        clientId,
        goal: input.goal || null,
        dailyLimit: input.dailyLimit ?? 30,
        minDelaySec: input.minDelaySec ?? 45,
        maxDelaySec: input.maxDelaySec ?? 180,
      },
    });

    if (input.socialAccountIds?.length) {
      await tx.campaignAccount.createMany({
        data: input.socialAccountIds.map((socialAccountId) => ({
          campaignId: created.id,
          socialAccountId,
        })),
      });
    }

    if (input.listenerQuery) {
      await tx.listener.create({
        data: {
          workspaceId: auth.workspaceId,
          campaignId: created.id,
          platform: input.platform,
          type: "keyword",
          query: input.listenerQuery,
          isActive: true,
        },
      });
    }

    return created;
  });

  await writeAuditLog({
    workspaceId: auth.workspaceId,
    action: "api.campaign.created",
    resourceType: "campaign",
    resourceId: campaign.id,
    metadata: {
      name: campaign.name,
      platform: campaign.platform,
      keyId: auth.keyId,
    },
  });

  return NextResponse.json(
    {
      data: {
        id: campaign.id,
        name: campaign.name,
        platform: campaign.platform,
        status: campaign.status,
        mode: campaign.mode,
        goal: campaign.goal,
        dailyLimit: campaign.dailyLimit,
        clientId: campaign.clientId,
        createdAt: campaign.createdAt,
      },
    },
    { status: 201 },
  );
}
