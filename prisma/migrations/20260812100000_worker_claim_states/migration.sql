-- Add transient claim states used by atomic worker claims, plus a delivery
-- kind for publish webhook receipts persisted to the database.

ALTER TYPE "TargetPostStatus" ADD VALUE IF NOT EXISTS 'generating';
ALTER TYPE "ContentDraftStatus" ADD VALUE IF NOT EXISTS 'publishing';
ALTER TYPE "DeliveryKind" ADD VALUE IF NOT EXISTS 'publish_webhook';

-- Track last state change on CommentAction so stale "sending" claims can be
-- recovered by the worker sweep.
ALTER TABLE "CommentAction" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Publish webhook deliveries may arrive unscoped; persist them anyway.
ALTER TABLE "DeliveryLog" ALTER COLUMN "workspaceId" DROP NOT NULL;
