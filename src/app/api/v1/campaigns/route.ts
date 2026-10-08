import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withApiV1 } from "@/lib/api-v1";
import { apiError } from "@/lib/api-errors";
import { db } from "@/lib/db";

const listQuerySchema = z.object({
  status: z
    .enum(["draft", "active", "paused", "completed", "failed"])
    .or(z.literal("all"))
    .optional(),
  clientId: z.string().trim().max(64).optional(),
  q: z.string().trim().max(200).optional(),
});

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  platform: z.enum(["instagram", "threads", "tiktok"]),
  mode: z.enum(["approval_required", "auto"]).optional(),
  // L2: API-created campaigns always start in a non-terminal state. Accepting
  // `completed`/`failed` from an integration key would let one key forge the
  // terminal status of shared-workspace campaigns.
  status: z.enum(["draft", "active", "paused"]).optional(),
  agentId: z.string().trim().max(64).optional(),
  clientId: z.string().trim().max(64).optional(),
  dailyLimit: z.number().int().min(1).max(500).optional(),
  minDelaySec: z.number().int().min(0).max(3600).optional(),
  maxDelaySec: z.number().int().min(0).max(7200).optional(),
  goal: z.string().trim().max(500).optional(),
});

export async function GET(req: NextRequest) {
  const auth = await withApiV1(req, "api:v1:campaigns", "campaigns:read");
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const queryParsed = listQuerySchema.safeParse({
    status: url.searchParams.get("status") || undefined,
    clientId: url.searchParams.get("clientId") || undefined,
    q: url.searchParams.get("q") || undefined,
  });
  if (!queryParsed.success) {
    return apiError(
      "INVALID_QUERY",
      400,
      queryParsed.error.issues[0]?.message || "Invalid query",
    );
  }
  const { status, clientId, q } = queryParsed.data;

  const where: Record<string, unknown> = { workspaceId: auth.workspaceId };
  if (status && status !== "all") where.status = status;
  if (clientId) where.clientId = clientId;
  if (q) where.name = { contains: q, mode: "insensitive" };

  let campaigns;
  try {
    campaigns = await db.campaign.findMany({
      where,
      include: {
        agent: { select: { id: true, name: true } },
        client: { select: { id: true, name: true, slug: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  } catch {
    return apiError("SERVICE_UNAVAILABLE", 503);
  }

  return NextResponse.json({
    data: campaigns,
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

  // Reference lookups: 404 when the id is valid but not in this workspace,
  // 503 when the database itself is unreachable.
  try {
    if (input.agentId) {
      const agent = await db.agent.findFirst({
        where: { id: input.agentId, workspaceId: auth.workspaceId },
        select: { id: true },
      });
      if (!agent) {
        return apiError("NOT_FOUND", 404, "Agent not found");
      }
    }

    if (input.clientId) {
      const client = await db.clientProfile.findFirst({
        where: { id: input.clientId, workspaceId: auth.workspaceId },
        select: { id: true },
      });
      if (!client) {
        return apiError("NOT_FOUND", 404, "Client not found");
      }
    }
  } catch {
    return apiError("SERVICE_UNAVAILABLE", 503);
  }

  const { getPlatformGuardrail, validateCampaignPacing } = await import("@/lib/platform-rate-limits");
  const delayFloor = getPlatformGuardrail(input.platform).comments.minIntervalSec;
  const pacing = validateCampaignPacing({
    platform: input.platform,
    dailyLimit: input.dailyLimit,
    minDelaySec: input.minDelaySec,
    maxDelaySec: input.maxDelaySec,
  });
  if (pacing.errors.length > 0) {
    return apiError("INVALID_INPUT", 400, pacing.errors.join("; "));
  }

  const campaign = await db.campaign.create({
    data: {
      workspaceId: auth.workspaceId,
      name: input.name,
      platform: input.platform,
      mode: input.mode ?? "approval_required",
      status: input.status ?? "draft",
      agentId: input.agentId,
      clientId: input.clientId,
      dailyLimit: pacing.clampedDailyLimit,
      minDelaySec: Math.max(input.minDelaySec ?? 180, delayFloor),
      maxDelaySec: Math.max(input.maxDelaySec ?? 600, input.minDelaySec ?? 180, delayFloor),
      goal: input.goal,
    },
  }).catch(() => null);

  if (!campaign) {
    return apiError("SERVICE_UNAVAILABLE", 503);
  }

  return NextResponse.json(
    {
      data: campaign,
      meta: { workspaceId: auth.workspaceId, keyId: auth.keyId },
    },
    { status: 201 },
  );
}
