import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withApiV1 } from "@/lib/api-v1";
import { apiError } from "@/lib/api-errors";
import { FEATURE_FLAG_KEYS, isFeatureEnabled } from "@/lib/feature-flags";
import { db } from "@/lib/db";
import { writeAuditLog } from "@/server/audit";

const createSchema = z.object({
  handle: z.string().trim().min(1).max(120),
  displayName: z.string().trim().max(160).optional(),
  contactEmail: z.string().trim().email().optional(),
  contactPhone: z.string().trim().max(40).optional(),
  platform: z.enum(["instagram", "threads", "tiktok"]).optional(),
  source: z.enum(["inbox", "approval", "comment", "manual", "api"]).optional(),
  intent: z.string().trim().max(500).optional(),
  notes: z.string().trim().max(5000).optional(),
  postSnippet: z.string().trim().max(2000).optional(),
  draftSnippet: z.string().trim().max(2000).optional(),
  externalUrl: z.string().url().optional(),
  targetPostId: z.string().min(1).optional(),
  campaignId: z.string().min(1).optional(),
  clientId: z.string().min(1).optional(),
  status: z
    .enum(["new", "contacted", "qualified", "won", "lost", "archived"])
    .optional(),
});

const LEAD_STATUSES = ["new", "contacted", "qualified", "won", "lost", "archived"] as const;

const listQuerySchema = z.object({
  status: z.enum(LEAD_STATUSES).or(z.literal("all")).optional(),
  clientId: z.string().trim().max(64).optional(),
  q: z.string().trim().max(200).optional(),
});

export async function GET(req: NextRequest) {
  const auth = await withApiV1(req, "api:v1:leads", "leads:read");
  if (!auth.ok) return auth.response;

  if (!(await isFeatureEnabled(FEATURE_FLAG_KEYS.leadCapture))) {
    return apiError("FEATURE_DISABLED", 403, "Lead capture disabled");
  }

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
  if (q) {
    where.OR = [
      { handle: { contains: q, mode: "insensitive" } },
      { displayName: { contains: q, mode: "insensitive" } },
      { intent: { contains: q, mode: "insensitive" } },
      { notes: { contains: q, mode: "insensitive" } },
      { contactEmail: { contains: q, mode: "insensitive" } },
    ];
  }

  let leads;
  try {
    leads = await db.engagementLead.findMany({
      where,
      include: {
        client: { select: { id: true, name: true, slug: true } },
        campaign: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  } catch {
    return apiError("SERVICE_UNAVAILABLE", 503);
  }

  return NextResponse.json({
    data: leads.map((lead) => ({
      id: lead.id,
      handle: lead.handle,
      displayName: lead.displayName,
      contactEmail: lead.contactEmail,
      contactPhone: lead.contactPhone,
      platform: lead.platform,
      source: lead.source,
      status: lead.status,
      intent: lead.intent,
      notes: lead.notes,
      externalUrl: lead.externalUrl,
      clientId: lead.clientId,
      client: lead.client,
      campaignId: lead.campaignId,
      campaign: lead.campaign,
      createdAt: lead.createdAt,
    })),
    meta: { count: leads.length, workspaceId: auth.workspaceId, keyId: auth.keyId },
  });
}

export async function POST(req: NextRequest) {
  const auth = await withApiV1(req, "api:v1:leads:write", "leads:write", {
    write: true,
  });
  if (!auth.ok) return auth.response;

  if (!(await isFeatureEnabled(FEATURE_FLAG_KEYS.leadCapture))) {
    return apiError("FEATURE_DISABLED", 403, "Lead capture disabled");
  }

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
  const handle = input.handle.replace(/^@/, "");

  try {
    if (input.clientId) {
      const client = await db.clientProfile.findFirst({
        where: { id: input.clientId, workspaceId: auth.workspaceId },
        select: { id: true },
      });
      if (!client) {
        return apiError("NOT_FOUND", 404, "Client not found");
      }
    }

    if (input.campaignId) {
      const campaign = await db.campaign.findFirst({
        where: { id: input.campaignId, workspaceId: auth.workspaceId },
        select: { id: true },
      });
      if (!campaign) {
        return apiError("NOT_FOUND", 404, "Campaign not found");
      }
    }

    if (input.targetPostId) {
      const post = await db.targetPost.findFirst({
        where: { id: input.targetPostId, workspaceId: auth.workspaceId },
        select: { id: true },
      });
      if (!post) {
        return apiError("NOT_FOUND", 404, "Target post not found");
      }
    }
  } catch {
    return apiError("SERVICE_UNAVAILABLE", 503);
  }

  let lead;
  try {
    lead = await db.engagementLead.create({
      data: {
        workspaceId: auth.workspaceId,
        handle,
        displayName: input.displayName || null,
        contactEmail: input.contactEmail?.toLowerCase() || null,
        contactPhone: input.contactPhone || null,
        platform: input.platform,
        source: input.source || "api",
        intent: input.intent || null,
        notes: input.notes || null,
        postSnippet: input.postSnippet || null,
        draftSnippet: input.draftSnippet || null,
        externalUrl: input.externalUrl || null,
        targetPostId: input.targetPostId || null,
        campaignId: input.campaignId || null,
        clientId: input.clientId || null,
        status: input.status || "new",
      },
      include: {
        client: { select: { id: true, name: true, slug: true } },
        campaign: { select: { id: true, name: true } },
      },
    });
  } catch {
    return apiError("SERVICE_UNAVAILABLE", 503);
  }

  await writeAuditLog({
    workspaceId: auth.workspaceId,
    action: "api.lead.created",
    resourceType: "engagement_lead",
    resourceId: lead.id,
    metadata: { handle: lead.handle, source: lead.source, keyId: auth.keyId },
  });

  try {
    const { dispatchExternal } = await import("@/lib/notify/dispatcher");
    await dispatchExternal("lead.captured", auth.workspaceId, {
      title: `New lead @${lead.handle}`,
      body: lead.intent || lead.notes || `Captured via ${lead.source}`,
      href: "/app/leads",
      extra: {
        leadId: lead.id,
        handle: lead.handle,
        email: lead.contactEmail,
        phone: lead.contactPhone,
        platform: lead.platform,
        source: lead.source,
        status: lead.status,
        intent: lead.intent,
        client: lead.client?.name,
        clientId: lead.clientId,
        campaign: lead.campaign?.name,
        campaignId: lead.campaignId,
        externalUrl: lead.externalUrl,
      },
    });
  } catch {
    // non-fatal
  }

  return NextResponse.json(
    {
      data: {
        id: lead.id,
        handle: lead.handle,
        status: lead.status,
        source: lead.source,
        clientId: lead.clientId,
        campaignId: lead.campaignId,
        createdAt: lead.createdAt,
      },
    },
    { status: 201 },
  );
}
