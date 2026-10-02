-- Mention ingest + auto-reply pipeline:
--   Mention        = incoming comment/mention on the workspace's own accounts
--   AutoReplySettings = per-workspace auto-reply configuration (1:1)
--   CommentDraft.mentionId / CommentAction.mentionId = pipeline linkage
--   CommentAction  = reply-to-comment fields + retry bookkeeping
--   DeliveryKind   = mention_ingest for webhook/ingest audit rows
--
-- Order matters: Mention must exist before CommentAction/CommentDraft FKs
-- reference it.

CREATE TYPE "CommentSource" AS ENUM ('target_post', 'mention_reply');

CREATE TYPE "MentionStatus" AS ENUM ('new', 'generating', 'drafted', 'approved', 'sent', 'ignored', 'failed');

-- Mention: deduped on (workspace, platform, externalId) so a webhook retry or
-- polling overlap cannot create a duplicate.
CREATE TABLE "Mention" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "socialAccountId" TEXT,
    "externalId" TEXT NOT NULL,
    "parentExternalId" TEXT NOT NULL,
    "parentContent" TEXT NOT NULL,
    "authorHandle" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "url" TEXT,
    "status" "MentionStatus" NOT NULL DEFAULT 'new',
    "rawPayload" JSONB,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Mention_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Mention" ADD CONSTRAINT "Mention_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Mention" ADD CONSTRAINT "Mention_socialAccountId_fkey" FOREIGN KEY ("socialAccountId") REFERENCES "SocialAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "Mention_workspaceId_platform_externalId_key" ON "Mention"("workspaceId", "platform", "externalId");
CREATE INDEX "Mention_workspaceId_status_receivedAt_idx" ON "Mention"("workspaceId", "status", "receivedAt" DESC);
CREATE INDEX "Mention_socialAccountId_receivedAt_idx" ON "Mention"("socialAccountId", "receivedAt" DESC);

-- AutoReplySettings: 1:1 with workspace.
CREATE TABLE "AutoReplySettings" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "agentId" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'approval_required',
    "maxRepliesPerDay" INTEGER NOT NULL DEFAULT 20,
    "quietHoursApply" BOOLEAN NOT NULL DEFAULT true,
    "templateText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutoReplySettings_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "AutoReplySettings" ADD CONSTRAINT "AutoReplySettings_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AutoReplySettings" ADD CONSTRAINT "AutoReplySettings_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "AutoReplySettings_workspaceId_key" ON "AutoReplySettings"("workspaceId");

-- CommentAction: reply metadata + retry counter (fail-closed default keeps
-- existing rows on the legacy target_post path).
ALTER TABLE "CommentAction" ADD COLUMN "source" "CommentSource" NOT NULL DEFAULT 'target_post',
    ADD COLUMN "replyToExternalId" TEXT,
    ADD COLUMN "replyToAuthor" TEXT,
    ADD COLUMN "mentionId" TEXT,
    ADD COLUMN "attemptCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "CommentAction" ADD CONSTRAINT "CommentAction_mentionId_fkey" FOREIGN KEY ("mentionId") REFERENCES "Mention"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "CommentAction_mentionId_key" ON "CommentAction"("mentionId");
CREATE INDEX "CommentAction_workspaceId_status_scheduledFor_idx" ON "CommentAction"("workspaceId", "status", "scheduledFor");

-- CommentDraft: link to the originating mention (unique — one draft per mention).
ALTER TABLE "CommentDraft" ADD COLUMN "mentionId" TEXT;
ALTER TABLE "CommentDraft" ADD CONSTRAINT "CommentDraft_mentionId_fkey" FOREIGN KEY ("mentionId") REFERENCES "Mention"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "CommentDraft_mentionId_key" ON "CommentDraft"("mentionId");

-- DeliveryKind: mention_ingest rows store raw webhook payloads for debugging.
ALTER TYPE "DeliveryKind" ADD VALUE 'mention_ingest';
