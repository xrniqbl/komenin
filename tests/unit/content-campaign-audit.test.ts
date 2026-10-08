import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const draft = { findFirst: vi.fn(), findMany: vi.fn(), findUniqueOrThrow: vi.fn(), update: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn(), create: vi.fn(), count: vi.fn() };
  const campaign = { findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn(), updateMany: vi.fn() };
  return { draft, campaign, publish: vi.fn(), generate: vi.fn(), claim: vi.fn(), audit: vi.fn(), permission: vi.fn() };
});
vi.mock("@/lib/db", () => ({ db: { contentDraft: mocks.draft, contentCampaign: mocks.campaign, $transaction: (fn: (tx: unknown) => Promise<unknown>) => fn({ contentDraft: mocks.draft, contentCampaign: mocks.campaign }) } }));
vi.mock("@/server/workspace-access", () => ({ requireActiveWorkspace: async () => ({ userId: "u", workspace: { id: "ws" } }) }));
vi.mock("@/lib/rbac", () => ({ assertWorkspacePermission: mocks.permission }));
vi.mock("@/server/audit", () => ({ writeAuditLog: mocks.audit }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/content-engine", () => ({ generateContentPosts: mocks.generate, buildContentSchedule: () => [new Date()] }));
vi.mock("@/lib/publish-connector", () => ({ publishSocialPost: mocks.publish }));
vi.mock("@/lib/worker-claims", () => ({ claimContentDraft: mocks.claim }));
vi.mock("@/lib/account-quota", () => ({ recordDailyAccountAction: vi.fn() }));
vi.mock("@/lib/runtime-mode", () => ({ getRuntimeModeLabel: () => "simulator" }));
vi.mock("@/server/agents", () => ({ ensureDefaultAgent: vi.fn() }));

import { bulkApproveContentDrafts, decideContentDraft, generateContentCampaignDrafts, publishDueContentDrafts, rescheduleContentDraft } from "@/server/content-campaigns";
const campaign = { id: "c", workspaceId: "ws", status: "active", topic: "topic", postCount: 1, platform: "instagram", intervalValue: 1, intervalUnit: "day", startAt: new Date(), mode: "approval_required", agent: null, agentId: "a", socialAccountId: null };
const draft = { id: "d", workspaceId: "ws", contentCampaignId: "c", status: "pending", title: "Title", body: "Body", socialAccountId: null, contentCampaign: campaign, scheduledFor: new Date(), hashtags: [] };

beforeEach(() => {
  vi.resetAllMocks();
  mocks.campaign.findFirst.mockResolvedValue(campaign);
  mocks.campaign.findMany.mockResolvedValue([]);
  mocks.draft.findFirst.mockResolvedValue(draft);
  mocks.draft.findUniqueOrThrow.mockResolvedValue(draft);
  mocks.draft.findMany.mockResolvedValue([]);
  mocks.draft.updateMany.mockResolvedValue({ count: 1 });
  mocks.generate.mockResolvedValue([{ sequence: 1, title: "New", body: "New body", hashtags: [] }]);
  mocks.claim.mockResolvedValue(true);
  mocks.publish.mockResolvedValue({ ok: true, publishedAt: new Date(), message: "Published" });
});

describe("content campaign audit regressions", () => {
  it("retains published history when regenerating", async () => {
    await generateContentCampaignDrafts("c");
    expect(mocks.draft.deleteMany).toHaveBeenCalledWith({ where: { contentCampaignId: "c", workspaceId: "ws", status: { in: ["pending", "scheduled", "approved", "rejected", "failed"] } } });
  });

  it("assigns regenerated drafts sequences after retained published history", async () => {
    mocks.draft.findFirst.mockResolvedValueOnce({ sequence: 4 });
    await generateContentCampaignDrafts("c");
    expect(mocks.draft.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ sequence: 5 }) }));
  });

  it.each(["publishing", "scheduled", "failed", "approved"])("rejects approval of %s", async (status) => {
    mocks.draft.findFirst.mockResolvedValue({ ...draft, status });
    await expect(decideContentDraft({ draftId: "d", decision: "approved" })).rejects.toThrow();
    expect(mocks.draft.update).not.toHaveBeenCalled();
  });

  it("rejects rejection of publishing draft", async () => {
    mocks.draft.findFirst.mockResolvedValue({ ...draft, status: "publishing" });
    await expect(decideContentDraft({ draftId: "d", decision: "rejected" })).rejects.toThrow();
  });

  it("does not mutate a draft changed between approval read and write", async () => {
    mocks.draft.updateMany.mockResolvedValue({ count: 0 });
    await expect(decideContentDraft({ draftId: "d", decision: "approved" })).rejects.toThrow();
    expect(mocks.draft.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ status: "pending" }) }));
  });

  it.each(["publishing", "rejected", "failed"])("does not reschedule %s", async (status) => {
    mocks.draft.findFirst.mockResolvedValue({ ...draft, status });
    await expect(rescheduleContentDraft({ draftId: "d", scheduledFor: new Date() })).rejects.toThrow();
    expect(mocks.draft.update).not.toHaveBeenCalled();
  });

  it("does not reschedule if publishing claimed after the read", async () => {
    mocks.draft.updateMany.mockResolvedValue({ count: 0 });
    await expect(rescheduleContentDraft({ draftId: "d", scheduledFor: new Date() })).rejects.toThrow();
  });

  it("bulk approval only transitions still-pending drafts and reports the actual count", async () => {
    mocks.draft.findMany.mockResolvedValue([{ id: "d" }]);
    mocks.draft.updateMany.mockResolvedValue({ count: 0 });
    expect(await bulkApproveContentDrafts({ campaignId: "c" })).toEqual({ approved: 0 });
    expect(mocks.draft.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ status: "pending" }) }));
  });

  it("does not publish drafts from paused campaigns", async () => {
    mocks.draft.findMany.mockResolvedValue([{ ...draft, status: "scheduled", contentCampaign: { ...campaign, status: "paused" } }]);
    await publishDueContentDrafts();
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it("passes a stable per-draft idempotency key to manual publishing", async () => {
    mocks.draft.findMany.mockResolvedValue([{ ...draft, status: "scheduled" }]);
    await publishDueContentDrafts();
    expect(mocks.publish).toHaveBeenCalledWith(expect.objectContaining({ idempotencyKey: "content-draft:d" }));
  });
});
