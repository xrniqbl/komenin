"use server";

import { revalidatePath } from "next/cache";
import type { LeadSource, LeadStatus, Platform } from "@prisma/client";
import { assertWorkspacePermission } from "@/lib/rbac";
import { db } from "@/lib/db";
import { requireActiveWorkspace } from "@/server/workspace-access";
import { writeAuditLog } from "@/server/audit";

export async function listLeads(input?: {
  status?: LeadStatus | "all";
  q?: string;
  clientId?: string;
  /** When true, only leads with followUpAt <= now and not won/lost/archived. */
  dueFollowUp?: boolean;
}) {
  const { workspace } = await requireActiveWorkspace();
  const where: Record<string, unknown> = { workspaceId: workspace.id };
  if (input?.status && input.status !== "all") where.status = input.status;
  if (input?.clientId) where.clientId = input.clientId;
  if (input?.dueFollowUp) {
    where.followUpAt = { lte: new Date() };
    where.status = { notIn: ["won", "lost", "archived"] };
  }
  if (input?.q?.trim()) {
    const q = input.q.trim();
    where.OR = [
      { handle: { contains: q, mode: "insensitive" } },
      { displayName: { contains: q, mode: "insensitive" } },
      { intent: { contains: q, mode: "insensitive" } },
      { notes: { contains: q, mode: "insensitive" } },
      { contactEmail: { contains: q, mode: "insensitive" } },
    ];
  }

  return db.engagementLead.findMany({
    where,
    include: {
      client: { select: { id: true, name: true, slug: true } },
      campaign: { select: { id: true, name: true } },
      targetPost: { select: { id: true, url: true, authorHandle: true } },
    },
    orderBy: [{ followUpAt: "asc" }, { createdAt: "desc" }],
    take: 100,
  });
}

export async function createLead(input: {
  handle: string;
  displayName?: string;
  contactEmail?: string;
  contactPhone?: string;
  platform?: Platform;
  source?: LeadSource;
  intent?: string;
  notes?: string;
  postSnippet?: string;
  draftSnippet?: string;
  externalUrl?: string;
  targetPostId?: string;
  campaignId?: string;
  clientId?: string;
  status?: LeadStatus;
  ownerUserId?: string | null;
  followUpAt?: string | Date | null;
}) {
  const { userId, workspace } = await requireActiveWorkspace();
  assertWorkspacePermission(workspace, "campaigns.manage");

  const handle = input.handle.trim().replace(/^@/, "");
  if (!handle) throw new Error("Handle is required");

  if (input.clientId) {
    const client = await db.clientProfile.findFirst({
      where: { id: input.clientId, workspaceId: workspace.id },
      select: { id: true },
    });
    if (!client) throw new Error("Client not found");
  }

  if (input.targetPostId) {
    const post = await db.targetPost.findFirst({
      where: { id: input.targetPostId, workspaceId: workspace.id },
      select: { id: true },
    });
    if (!post) throw new Error("Target post not found");
  }

  if (input.campaignId) {
    const campaign = await db.campaign.findFirst({
      where: { id: input.campaignId, workspaceId: workspace.id },
      select: { id: true },
    });
    if (!campaign) throw new Error("Campaign not found");
  }

  const followUpAt =
    input.followUpAt === undefined
      ? undefined
      : input.followUpAt
        ? new Date(input.followUpAt)
        : null;
  if (followUpAt && Number.isNaN(followUpAt.getTime())) {
    throw new Error("Invalid follow-up date");
  }

  const lead = await db.engagementLead.create({
    data: {
      workspaceId: workspace.id,
      handle,
      displayName: input.displayName?.trim() || null,
      contactEmail: input.contactEmail?.trim().toLowerCase() || null,
      contactPhone: input.contactPhone?.trim() || null,
      platform: input.platform,
      source: input.source || "manual",
      intent: input.intent?.trim() || null,
      notes: input.notes?.trim() || null,
      postSnippet: input.postSnippet?.trim() || null,
      draftSnippet: input.draftSnippet?.trim() || null,
      externalUrl: input.externalUrl?.trim() || null,
      targetPostId: input.targetPostId || null,
      campaignId: input.campaignId || null,
      clientId: input.clientId || null,
      status: input.status || "new",
      ownerUserId:
        input.ownerUserId === undefined
          ? userId
          : input.ownerUserId?.trim() || null,
      followUpAt: followUpAt === undefined ? null : followUpAt,
    },
    include: {
      client: { select: { id: true, name: true, slug: true } },
      campaign: { select: { id: true, name: true } },
    },
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    actorUserId: userId,
    action: "lead.created",
    resourceType: "engagement_lead",
    resourceId: lead.id,
    metadata: {
      handle: lead.handle,
      source: lead.source,
      status: lead.status,
      clientId: lead.clientId,
    },
  });

  try {
    const { dispatchExternal } = await import("@/lib/notify/dispatcher");
    await dispatchExternal("lead.captured", workspace.id, {
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

  revalidatePath("/app/leads");
  revalidatePath("/app/inbox");
  revalidatePath("/app/approvals");
  return lead;
}

export async function captureLeadFromTargetPost(input: {
  targetPostId: string;
  intent?: string;
  notes?: string;
  contactEmail?: string;
  clientId?: string;
}) {
  const { workspace } = await requireActiveWorkspace();
  assertWorkspacePermission(workspace, "campaigns.manage");

  const post = await db.targetPost.findFirst({
    where: { id: input.targetPostId, workspaceId: workspace.id },
    include: {
      drafts: { orderBy: { createdAt: "desc" }, take: 1 },
      campaign: { select: { id: true, clientId: true } },
    },
  });
  if (!post) throw new Error("Target post not found");

  return createLead({
    handle: post.authorHandle,
    platform: post.platform,
    source: "inbox",
    intent: input.intent,
    notes: input.notes,
    contactEmail: input.contactEmail,
    postSnippet: post.content.slice(0, 500),
    draftSnippet: post.drafts[0]?.content?.slice(0, 500),
    externalUrl: post.url || undefined,
    targetPostId: post.id,
    campaignId: post.campaignId || undefined,
    clientId: input.clientId || post.campaign?.clientId || undefined,
  });
}

export async function captureLeadFromApproval(input: {
  approvalId: string;
  intent?: string;
  notes?: string;
  contactEmail?: string;
  clientId?: string;
}) {
  const { workspace } = await requireActiveWorkspace();
  assertWorkspacePermission(workspace, "campaigns.manage");

  const approval = await db.approval.findFirst({
    where: { id: input.approvalId, workspaceId: workspace.id },
    include: {
      targetPost: true,
      commentDraft: true,
      campaign: { select: { id: true, clientId: true } },
    },
  });
  if (!approval) throw new Error("Approval not found");

  return createLead({
    handle: approval.targetPost.authorHandle,
    platform: approval.targetPost.platform,
    source: "approval",
    intent: input.intent,
    notes: input.notes,
    contactEmail: input.contactEmail,
    postSnippet: approval.targetPost.content.slice(0, 500),
    draftSnippet: approval.commentDraft.content.slice(0, 500),
    externalUrl: approval.targetPost.url || undefined,
    targetPostId: approval.targetPostId,
    campaignId: approval.campaignId || undefined,
    clientId: input.clientId || approval.campaign?.clientId || undefined,
  });
}

function csvEscape(value: string | number | null | undefined): string {
  const raw = value == null ? "" : String(value);
  if (/[",\n\r]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

/** Build a CSV export of current workspace leads (up to 500 rows). */
export async function exportLeadsCsv(input?: {
  status?: LeadStatus | "all";
  clientId?: string;
}) {
  const { workspace } = await requireActiveWorkspace();
  assertWorkspacePermission(workspace, "analytics.view");

  const where: Record<string, unknown> = { workspaceId: workspace.id };
  if (input?.status && input.status !== "all") where.status = input.status;
  if (input?.clientId) where.clientId = input.clientId;

  const leads = await db.engagementLead.findMany({
    where,
    include: {
      client: { select: { name: true, slug: true } },
      campaign: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  const header = [
    "id",
    "handle",
    "displayName",
    "email",
    "phone",
    "platform",
    "source",
    "status",
    "intent",
    "notes",
    "client",
    "campaign",
    "ownerUserId",
    "followUpAt",
    "externalUrl",
    "createdAt",
  ];

  const lines = [
    header.join(","),
    ...leads.map((lead) =>
      [
        lead.id,
        lead.handle,
        lead.displayName,
        lead.contactEmail,
        lead.contactPhone,
        lead.platform,
        lead.source,
        lead.status,
        lead.intent,
        lead.notes,
        lead.client?.name,
        lead.campaign?.name,
        lead.ownerUserId,
        lead.followUpAt?.toISOString() || "",
        lead.externalUrl,
        lead.createdAt.toISOString(),
      ]
        .map(csvEscape)
        .join(","),
    ),
  ];

  return {
    filename: `komenin-leads-${new Date().toISOString().slice(0, 10)}.csv`,
    csv: lines.join("\n"),
    count: leads.length,
  };
}

export async function updateLeadStatus(input: {
  leadId: string;
  status: LeadStatus;
  notes?: string;
}) {
  const { userId, workspace } = await requireActiveWorkspace();
  assertWorkspacePermission(workspace, "campaigns.manage");

  const existing = await db.engagementLead.findFirst({
    where: { id: input.leadId, workspaceId: workspace.id },
  });
  if (!existing) throw new Error("Lead not found");

  const lead = await db.engagementLead.update({
    where: { id: existing.id },
    data: {
      status: input.status,
      notes: input.notes?.trim() || existing.notes,
    },
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    actorUserId: userId,
    action: "lead.status_updated",
    resourceType: "engagement_lead",
    resourceId: lead.id,
    metadata: { from: existing.status, to: lead.status },
  });

  revalidatePath("/app/leads");
  return lead;
}

export async function updateLeadFollowUp(input: {
  leadId: string;
  followUpAt?: string | Date | null;
  ownerUserId?: string | null;
  notes?: string;
  status?: LeadStatus;
}) {
  const { userId, workspace } = await requireActiveWorkspace();
  assertWorkspacePermission(workspace, "campaigns.manage");

  const existing = await db.engagementLead.findFirst({
    where: { id: input.leadId, workspaceId: workspace.id },
  });
  if (!existing) throw new Error("Lead not found");

  const followUpAt =
    input.followUpAt === undefined
      ? undefined
      : input.followUpAt
        ? new Date(input.followUpAt)
        : null;
  if (followUpAt && Number.isNaN(followUpAt.getTime())) {
    throw new Error("Invalid follow-up date");
  }

  const lead = await db.engagementLead.update({
    where: { id: existing.id },
    data: {
      followUpAt: followUpAt === undefined ? existing.followUpAt : followUpAt,
      ownerUserId:
        input.ownerUserId === undefined
          ? existing.ownerUserId
          : input.ownerUserId?.trim() || null,
      notes: input.notes !== undefined ? input.notes.trim() || null : existing.notes,
      status: input.status || existing.status,
    },
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    actorUserId: userId,
    action: "lead.followup_updated",
    resourceType: "engagement_lead",
    resourceId: lead.id,
    metadata: {
      followUpAt: lead.followUpAt,
      ownerUserId: lead.ownerUserId,
      status: lead.status,
    },
  });

  revalidatePath("/app/leads");
  return lead;
}
