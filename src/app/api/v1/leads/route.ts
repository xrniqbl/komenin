import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withApiV1 } from "@/lib/api-v1";
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

export async function GET(req: NextRequest) {
  const auth = await withApiV1(req, "api:v1:leads", "leads:read");
  if (!auth.ok) return auth.response;

  if (!(await isFeatureEnabled(FEATURE_FLAG_KEYS.leadCapture))) {
    return NextResponse.json(
      { error: "Lead capture disabled", code: "FEATURE_DISABLED" },
      { status: 403 },
    );
  }

  const url = new URL(req.url);
  const status = url.searchParams.get("status") || undefined;
  const clientId = url.searchParams.get("clientId") || undefined;
  const q = url.searchParams.get("q")?.trim() || undefined;

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

  const leads = await db.engagementLead.findMany({
    where,
    include: {
      client: { select: { id: true, name: true, slug: true } },
      campaign: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

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
    return NextResponse.json(
      { error: "Lead capture disabled", code: "FEATURE_DISABLED" },
      { status: 403 },
    );
  }

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
  const handle = input.handle.replace(/^@/, "");

  if (input.clientId) {
    const client = await db.clientProfile.findFirst({
      where: { id: input.clientId, workspaceId: auth.workspaceId },
      select: { id: true },
    });
    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 400 });
    }
  }

  if (input.campaignId) {
    const campaign = await db.campaign.findFirst({
      where: { id: input.campaignId, workspaceId: auth.workspaceId },
      select: { id: true },
    });
    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 400 });
    }
  }

  if (input.targetPostId) {
    const post = await db.targetPost.findFirst({
      where: { id: input.targetPostId, workspaceId: auth.workspaceId },
      select: { id: true },
    });
    if (!post) {
      return NextResponse.json({ error: "Target post not found" }, { status: 400 });
    }
  }

  const lead = await db.engagementLead.create({
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
